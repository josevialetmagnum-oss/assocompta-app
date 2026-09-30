import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/association", async () => (await import("../support/contexte")).moduleAssociationDeTest());

import { prisma } from "@/lib/prisma";
import { autoriseSoldesOuverture, resultatParCategorie, situationTresorerie, soldesJournaux } from "@/lib/tresorerie";
import { creerJeuComplet, type Jeu } from "../support/jeu-de-donnees";
import { verifierBaseDeTest, viderBase } from "../support/base-test";

describe("calculs de trésorerie", () => {
  let jeu: Jeu;

  beforeEach(async () => {
    verifierBaseDeTest();
    await viderBase();
    jeu = await creerJeuComplet();
  });

  it("le solde d'un journal cumule recettes et dépenses", async () => {
    await prisma.mouvement.create({
      data: {
        associationId: jeu.associationId, exerciceId: jeu.exerciceId, journalId: jeu.journalId,
        date: new Date("2026-02-01"), type: "recette", typeTransaction: "especes", montant: 100,
        ventilations: { create: [{ sousCategorieId: jeu.sousCategorieRecette, montant: 100 }] },
      },
    });
    await prisma.mouvement.create({
      data: {
        associationId: jeu.associationId, exerciceId: jeu.exerciceId, journalId: jeu.journalId,
        date: new Date("2026-03-01"), type: "depense", typeTransaction: "especes", montant: 30,
        ventilations: { create: [{ sousCategorieId: jeu.sousCategorieDepense, montant: 30 }] },
      },
    });

    const soldes = await soldesJournaux(jeu.associationId);
    expect(soldes).toEqual([{ journalId: jeu.journalId, nom: "Caisse", solde: 70 }]);
  });

  it("un virement interne déplace le solde d'un journal vers un autre sans affecter le résultat", async () => {
    const autreJournal = await prisma.journal.create({ data: { associationId: jeu.associationId, nom: "Banque" } });
    await prisma.mouvement.create({
      data: {
        associationId: jeu.associationId, exerciceId: jeu.exerciceId, journalId: jeu.journalId,
        journalDestinationId: autreJournal.id, date: new Date("2026-02-01"), type: "virement_interne",
        typeTransaction: "virement", montant: 50,
      },
    });

    const soldes = await soldesJournaux(jeu.associationId);
    expect(soldes.find((s) => s.journalId === jeu.journalId)?.solde).toBe(-50);
    expect(soldes.find((s) => s.journalId === autreJournal.id)?.solde).toBe(50);

    const situation = await situationTresorerie(jeu.associationId, jeu.exerciceId);
    expect(situation).toEqual({ totalRecettes: 0, totalDepenses: 0, resultat: 0 });
  });

  it("le résultat analytique regroupe les ventilations par catégorie", async () => {
    await prisma.mouvement.create({
      data: {
        associationId: jeu.associationId, exerciceId: jeu.exerciceId, journalId: jeu.journalId,
        date: new Date("2026-02-01"), type: "recette", typeTransaction: "especes", montant: 80,
        ventilations: { create: [{ sousCategorieId: jeu.sousCategorieRecette, montant: 80 }] },
      },
    });
    await prisma.mouvement.create({
      data: {
        associationId: jeu.associationId, exerciceId: jeu.exerciceId, journalId: jeu.journalId,
        date: new Date("2026-02-05"), type: "recette", typeTransaction: "especes", montant: 20,
        ventilations: { create: [{ sousCategorieId: jeu.sousCategorieRecette, montant: 20 }] },
      },
    });

    const lignes = await resultatParCategorie(jeu.associationId, jeu.exerciceId);
    expect(lignes).toEqual([{ categorieId: expect.any(Number), nom: "Cotisations", type: "recette", total: 100 }]);

    const situation = await situationTresorerie(jeu.associationId, jeu.exerciceId);
    expect(situation).toEqual({ totalRecettes: 100, totalDepenses: 0, resultat: 100 });
  });

  it("un mouvement d'un autre exercice n'entre pas dans le résultat de celui-ci", async () => {
    const autreExercice = await prisma.exercice.create({
      data: { associationId: jeu.associationId, libelle: "2025", dateDebut: new Date("2025-01-01"), dateFin: new Date("2025-12-31") },
    });
    await prisma.mouvement.create({
      data: {
        associationId: jeu.associationId, exerciceId: autreExercice.id, journalId: jeu.journalId,
        date: new Date("2025-06-01"), type: "recette", typeTransaction: "especes", montant: 999,
        ventilations: { create: [{ sousCategorieId: jeu.sousCategorieRecette, montant: 999 }] },
      },
    });

    const situation = await situationTresorerie(jeu.associationId, jeu.exerciceId);
    expect(situation.totalRecettes).toBe(0);
    // Mais le solde du journal (temps réel) inclut bien tous les exercices.
    const soldes = await soldesJournaux(jeu.associationId);
    expect(soldes[0].solde).toBe(999);
  });

  it("le solde d'ouverture d'un journal (reprise d'un compte existant) s'ajoute aux mouvements", async () => {
    await prisma.journal.update({ where: { id: jeu.journalId }, data: { soldeInitial: 500 } });
    await prisma.mouvement.create({
      data: {
        associationId: jeu.associationId, exerciceId: jeu.exerciceId, journalId: jeu.journalId,
        date: new Date("2026-02-01"), type: "depense", typeTransaction: "especes", montant: 30,
        ventilations: { create: [{ sousCategorieId: jeu.sousCategorieDepense, montant: 30 }] },
      },
    });
    const soldes = await soldesJournaux(jeu.associationId);
    expect(soldes[0].solde).toBe(470);
  });
});

describe("autoriseSoldesOuverture", () => {
  let jeu: Jeu;

  beforeEach(async () => {
    verifierBaseDeTest();
    await viderBase();
    jeu = await creerJeuComplet();
  });

  it("autorise tant que l'exercice le plus récent n'a reçu aucun mouvement", async () => {
    expect(await autoriseSoldesOuverture(jeu.associationId)).toBe(true);
  });

  it("refuse dès que l'exercice le plus récent a un mouvement", async () => {
    await prisma.mouvement.create({
      data: {
        associationId: jeu.associationId, exerciceId: jeu.exerciceId, journalId: jeu.journalId,
        date: new Date("2026-02-01"), type: "recette", typeTransaction: "especes", montant: 10,
        ventilations: { create: [{ sousCategorieId: jeu.sousCategorieRecette, montant: 10 }] },
      },
    });
    expect(await autoriseSoldesOuverture(jeu.associationId)).toBe(false);
  });

  it("autorise pour une association sans aucun exercice", async () => {
    const autreAssociation = await prisma.association.create({ data: { nom: "Sans exercice" } });
    expect(await autoriseSoldesOuverture(autreAssociation.id)).toBe(true);
  });
});
