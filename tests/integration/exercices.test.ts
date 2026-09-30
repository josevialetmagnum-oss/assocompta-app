import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/association", async () => (await import("../support/contexte")).moduleAssociationDeTest());
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { prisma } from "@/lib/prisma";
import { creerExercice } from "@/app/parametrage/actions";
import { soldesJournaux } from "@/lib/tresorerie";
import { creerJeuComplet, type Jeu } from "../support/jeu-de-donnees";
import { verifierBaseDeTest, viderBase } from "../support/base-test";
import { contexte } from "../support/contexte";

function formData(champs: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) fd.set(k, v);
  return fd;
}

describe("création d'un exercice : soldes d'ouverture", () => {
  let jeu: Jeu;

  beforeEach(async () => {
    verifierBaseDeTest();
    await viderBase();
    jeu = await creerJeuComplet();
    contexte.associationId = jeu.associationId;
    contexte.lectureSeule = false;
  });

  it("applique les soldes d'ouverture quand l'exercice précédent est vide", async () => {
    const res = await creerExercice(undefined, formData({
      libelle: "2027",
      dateDebut: "2027-01-01",
      dateFin: "2027-12-31",
      soldesOuverture: JSON.stringify([{ journalId: jeu.journalId, solde: 250 }]),
    }));
    expect(res?.errors).toBeUndefined();

    const journal = await prisma.journal.findUniqueOrThrow({ where: { id: jeu.journalId } });
    expect(journal.soldeInitial).toBe(250);
    expect((await soldesJournaux(jeu.associationId))[0].solde).toBe(250);
  });

  it("ignore les soldes d'ouverture soumis si l'exercice précédent a déjà un mouvement", async () => {
    await prisma.mouvement.create({
      data: {
        associationId: jeu.associationId, exerciceId: jeu.exerciceId, journalId: jeu.journalId,
        date: new Date("2026-02-01"), type: "recette", typeTransaction: "especes", montant: 10,
        ventilations: { create: [{ sousCategorieId: jeu.sousCategorieRecette, montant: 10 }] },
      },
    });

    const res = await creerExercice(undefined, formData({
      libelle: "2027",
      dateDebut: "2027-01-01",
      dateFin: "2027-12-31",
      soldesOuverture: JSON.stringify([{ journalId: jeu.journalId, solde: 9999 }]),
    }));
    expect(res?.errors).toBeUndefined();

    const journal = await prisma.journal.findUniqueOrThrow({ where: { id: jeu.journalId } });
    expect(journal.soldeInitial).toBe(0);
    expect(await prisma.exercice.findUnique({ where: { associationId_libelle: { associationId: jeu.associationId, libelle: "2027" } } })).not.toBeNull();
  });

  it("ne touche jamais au journal d'une autre association", async () => {
    const autreJeu = await creerJeuComplet();
    // creerJeuComplet() positionne contexte.associationId sur la nouvelle association créée : on
    // le remet sur la première, celle dans le contexte de laquelle l'exercice est créé ici.
    contexte.associationId = jeu.associationId;
    const res = await creerExercice(undefined, formData({
      libelle: "2027",
      dateDebut: "2027-01-01",
      dateFin: "2027-12-31",
      soldesOuverture: JSON.stringify([{ journalId: autreJeu.journalId, solde: 500 }]),
    }));
    expect(res?.errors).toBeUndefined();
    const journalAutre = await prisma.journal.findUniqueOrThrow({ where: { id: autreJeu.journalId } });
    expect(journalAutre.soldeInitial).toBe(0);
  });
});
