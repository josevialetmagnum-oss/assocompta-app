import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { bilanExercice } from "@/lib/bilan";
import { situationTresorerie } from "@/lib/tresorerie";
import { creerJeuComplet, type Jeu } from "../support/jeu-de-donnees";
import { verifierBaseDeTest, viderBase } from "../support/base-test";

type Ligne = { sousCategorieId: number; montant: number };

async function mouvement(jeu: Jeu, exerciceId: number, type: "recette" | "depense", date: string, lignes: Ligne[], journalId = jeu.journalId) {
  await prisma.mouvement.create({
    data: {
      associationId: jeu.associationId, exerciceId, journalId,
      date: new Date(date), dateBilan: new Date(date), type, typeTransaction: "especes",
      montant: lignes.reduce((s, l) => s + l.montant, 0),
      ventilations: { create: lignes },
    },
  });
}

describe("bilan d'un exercice", () => {
  let jeu: Jeu;

  beforeEach(async () => {
    verifierBaseDeTest();
    await viderBase();
    jeu = await creerJeuComplet();
  });

  it("détaille recettes et dépenses par catégorie puis sous-catégorie, avec le résultat", async () => {
    const categorie = await prisma.categorie.findFirstOrThrow({ where: { associationId: jeu.associationId, type: "recette" } });
    const jeunes = await prisma.sousCategorie.create({ data: { categorieId: categorie.id, nom: "Cotisations jeunes" } });
    await prisma.sousCategorie.create({ data: { categorieId: categorie.id, nom: "Jamais utilisée" } });

    await mouvement(jeu, jeu.exerciceId, "recette", "2026-02-01", [
      { sousCategorieId: jeu.sousCategorieRecette, montant: 100 },
      { sousCategorieId: jeunes.id, montant: 40 },
    ]);
    await mouvement(jeu, jeu.exerciceId, "recette", "2026-03-01", [{ sousCategorieId: jeu.sousCategorieRecette, montant: 20 }]);
    await mouvement(jeu, jeu.exerciceId, "depense", "2026-04-01", [{ sousCategorieId: jeu.sousCategorieDepense, montant: 50 }]);

    const bilan = await bilanExercice(jeu.associationId, jeu.exerciceId);
    expect(bilan).not.toBeNull();
    expect(bilan!.recettes.categories).toHaveLength(1);
    expect(bilan!.recettes.categories[0]).toMatchObject({ nom: "Cotisations", total: 160 });
    // Sous-catégories sans mouvement : absentes.
    expect(bilan!.recettes.categories[0].sousCategories.map((s) => [s.nom, s.total])).toEqual([
      ["Cotisations annuelles", 120],
      ["Cotisations jeunes", 40],
    ]);
    expect(bilan!.depenses.total).toBe(50);
    expect(bilan!.resultat).toBe(110);
  });

  it("donne les mêmes totaux que l'état « Soldes et résultats »", async () => {
    await mouvement(jeu, jeu.exerciceId, "recette", "2026-02-01", [{ sousCategorieId: jeu.sousCategorieRecette, montant: 80 }]);
    await mouvement(jeu, jeu.exerciceId, "depense", "2026-02-02", [{ sousCategorieId: jeu.sousCategorieDepense, montant: 30 }]);

    const bilan = await bilanExercice(jeu.associationId, jeu.exerciceId);
    const situation = await situationTresorerie(jeu.associationId, jeu.exerciceId);
    expect(bilan!.recettes.total).toBe(situation.totalRecettes);
    expect(bilan!.depenses.total).toBe(situation.totalDepenses);
    expect(bilan!.resultat).toBe(situation.resultat);
  });

  it("l'ouverture reprend le solde initial et les exercices précédents ; ouverture + variation = clôture", async () => {
    await prisma.journal.update({ where: { id: jeu.journalId }, data: { soldeInitial: 500 } });
    const precedent = await prisma.exercice.create({
      data: { associationId: jeu.associationId, libelle: "2025", dateDebut: new Date("2025-01-01"), dateFin: new Date("2025-12-31") },
    });
    await mouvement(jeu, precedent.id, "recette", "2025-06-01", [{ sousCategorieId: jeu.sousCategorieRecette, montant: 200 }]);
    await mouvement(jeu, jeu.exerciceId, "depense", "2026-02-01", [{ sousCategorieId: jeu.sousCategorieDepense, montant: 70 }]);

    const bilan = await bilanExercice(jeu.associationId, jeu.exerciceId);
    expect(bilan!.comptes).toEqual([{ journalId: jeu.journalId, nom: "Caisse", ouverture: 700, variation: -70, cloture: 630 }]);

    const bilanPrecedent = await bilanExercice(jeu.associationId, precedent.id);
    expect(bilanPrecedent!.comptes[0]).toMatchObject({ ouverture: 500, variation: 200, cloture: 700 });
    // Les recettes du précédent exercice n'entrent pas dans le résultat de celui-ci.
    expect(bilan!.recettes.total).toBe(0);
  });

  it("un virement interne déplace la trésorerie d'un compte à l'autre sans changer le total ni le résultat", async () => {
    const banque = await prisma.journal.create({ data: { associationId: jeu.associationId, nom: "Banque" } });
    await prisma.mouvement.create({
      data: {
        associationId: jeu.associationId, exerciceId: jeu.exerciceId, journalId: jeu.journalId, journalDestinationId: banque.id,
        date: new Date("2026-02-01"), dateBilan: new Date("2026-02-01"), type: "virement_interne", typeTransaction: "virement", montant: 50,
      },
    });

    const bilan = await bilanExercice(jeu.associationId, jeu.exerciceId);
    expect(bilan!.comptes.map((c) => [c.nom, c.variation])).toEqual([["Banque", 50], ["Caisse", -50]]);
    expect(bilan!.totalVariation).toBe(0);
    expect(bilan!.resultat).toBe(0);
  });

  it("refuse l'exercice d'une autre association", async () => {
    const autre = await prisma.association.create({ data: { nom: "Autre association" } });
    const exerciceAutre = await prisma.exercice.create({
      data: { associationId: autre.id, libelle: "2026", dateDebut: new Date("2026-01-01"), dateFin: new Date("2026-12-31") },
    });
    expect(await bilanExercice(jeu.associationId, exerciceAutre.id)).toBeNull();
  });
});
