import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/association", async () => (await import("../support/contexte")).moduleAssociationDeTest());
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { prisma } from "@/lib/prisma";
import { creerMouvement } from "@/app/mouvements/actions";
import { soldesJournaux } from "@/lib/tresorerie";
import { creerJeuComplet, type Jeu } from "../support/jeu-de-donnees";
import { verifierBaseDeTest, viderBase } from "../support/base-test";
import { contexte } from "../support/contexte";

function formData(champs: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) fd.set(k, v);
  return fd;
}

describe("cloisonnement entre associations", () => {
  let jeuA: Jeu;
  let jeuB: Jeu;

  beforeEach(async () => {
    verifierBaseDeTest();
    await viderBase();
    jeuA = await creerJeuComplet();
    jeuB = await creerJeuComplet();
    contexte.associationId = jeuA.associationId;
    contexte.lectureSeule = false;
  });

  it("un journal d'une autre association est refusé", async () => {
    const res = await creerMouvement(undefined, formData({
      exerciceId: String(jeuA.exerciceId),
      journalId: String(jeuB.journalId),
      type: "depense",
      typeTransaction: "especes",
      date: "2026-03-15",
      ventilations: JSON.stringify([{ sousCategorieId: jeuA.sousCategorieDepense, montant: 10 }]),
    }));
    expect(res?.errors).toEqual(["Journal introuvable."]);
  });

  it("un exercice d'une autre association est refusé", async () => {
    const res = await creerMouvement(undefined, formData({
      exerciceId: String(jeuB.exerciceId),
      journalId: String(jeuA.journalId),
      type: "depense",
      typeTransaction: "especes",
      date: "2026-03-15",
      ventilations: JSON.stringify([{ sousCategorieId: jeuA.sousCategorieDepense, montant: 10 }]),
    }));
    expect(res?.errors).toEqual(["Exercice introuvable."]);
  });

  it("une sous-catégorie d'une autre association est refusée", async () => {
    const res = await creerMouvement(undefined, formData({
      exerciceId: String(jeuA.exerciceId),
      journalId: String(jeuA.journalId),
      type: "depense",
      typeTransaction: "especes",
      date: "2026-03-15",
      ventilations: JSON.stringify([{ sousCategorieId: jeuB.sousCategorieDepense, montant: 10 }]),
    }));
    expect(res?.errors).toEqual(["Une sous-catégorie sélectionnée n'appartient pas à cette association ou à ce type."]);
  });

  it("les soldes d'une association n'incluent jamais les mouvements d'une autre", async () => {
    await prisma.mouvement.create({
      data: {
        associationId: jeuB.associationId, exerciceId: jeuB.exerciceId, journalId: jeuB.journalId,
        date: new Date("2026-02-01"), type: "recette", typeTransaction: "especes", montant: 500,
        ventilations: { create: [{ sousCategorieId: jeuB.sousCategorieRecette, montant: 500 }] },
      },
    });
    const soldesA = await soldesJournaux(jeuA.associationId);
    expect(soldesA[0].solde).toBe(0);
  });
});
