import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/association", async () => (await import("../support/contexte")).moduleAssociationDeTest());
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { prisma } from "@/lib/prisma";
import { creerMouvement, supprimerMouvement } from "@/app/mouvements/actions";
import { creerJeuComplet, type Jeu } from "../support/jeu-de-donnees";
import { verifierBaseDeTest, viderBase } from "../support/base-test";
import { contexte } from "../support/contexte";

function formData(champs: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) fd.set(k, v);
  return fd;
}

describe("actions serveur des mouvements", () => {
  let jeu: Jeu;

  beforeEach(async () => {
    verifierBaseDeTest();
    await viderBase();
    jeu = await creerJeuComplet();
    contexte.lectureSeule = false;
  });

  it("crée une dépense avec ventilation, le montant total est la somme des lignes", async () => {
    const res = await creerMouvement(undefined, formData({
      exerciceId: String(jeu.exerciceId),
      journalId: String(jeu.journalId),
      type: "depense",
      typeTransaction: "cheque",
      date: "2026-03-15",
      numeroCheque: "1234",
      ventilations: JSON.stringify([{ sousCategorieId: jeu.sousCategorieDepense, montant: 45.9 }]),
    }));

    expect(res?.errors).toBeUndefined();
    const mouvement = await prisma.mouvement.findFirstOrThrow({ where: { associationId: jeu.associationId } });
    expect(mouvement.montant).toBe(45.9);
    expect(mouvement.type).toBe("depense");
  });

  it("refuse une ventilation dont la somme ne correspond à aucune ligne (aucune ligne = erreur)", async () => {
    const res = await creerMouvement(undefined, formData({
      exerciceId: String(jeu.exerciceId),
      journalId: String(jeu.journalId),
      type: "depense",
      typeTransaction: "especes",
      date: "2026-03-15",
      ventilations: "[]",
    }));
    expect(res?.errors).toEqual(["Ajoutez au moins une ligne de ventilation."]);
  });

  it("refuse une sous-catégorie d'un mauvais type (recette pour une dépense)", async () => {
    const res = await creerMouvement(undefined, formData({
      exerciceId: String(jeu.exerciceId),
      journalId: String(jeu.journalId),
      type: "depense",
      typeTransaction: "especes",
      date: "2026-03-15",
      ventilations: JSON.stringify([{ sousCategorieId: jeu.sousCategorieRecette, montant: 10 }]),
    }));
    expect(res?.errors).toEqual(["Une sous-catégorie sélectionnée n'appartient pas à cette association ou à ce type."]);
  });

  it("refuse toute saisie sur un exercice clôturé", async () => {
    await prisma.exercice.update({ where: { id: jeu.exerciceId }, data: { cloture: true } });
    const res = await creerMouvement(undefined, formData({
      exerciceId: String(jeu.exerciceId),
      journalId: String(jeu.journalId),
      type: "depense",
      typeTransaction: "especes",
      date: "2026-03-15",
      ventilations: JSON.stringify([{ sousCategorieId: jeu.sousCategorieDepense, montant: 10 }]),
    }));
    expect(res?.errors).toEqual(["Cet exercice est clôturé : aucune saisie n'est plus possible."]);
  });

  it("un compte en lecture seule ne peut pas créer de mouvement", async () => {
    contexte.lectureSeule = true;
    await expect(
      creerMouvement(undefined, formData({
        exerciceId: String(jeu.exerciceId),
        journalId: String(jeu.journalId),
        type: "depense",
        typeTransaction: "especes",
        date: "2026-03-15",
        ventilations: JSON.stringify([{ sousCategorieId: jeu.sousCategorieDepense, montant: 10 }]),
      })),
    ).rejects.toThrow();
  });

  it("un virement interne déplace le montant sans ventilation", async () => {
    const autreJournal = await prisma.journal.create({ data: { associationId: jeu.associationId, nom: "Banque" } });
    const res = await creerMouvement(undefined, formData({
      exerciceId: String(jeu.exerciceId),
      journalId: String(jeu.journalId),
      type: "virement_interne",
      typeTransaction: "virement",
      date: "2026-03-15",
      journalDestinationId: String(autreJournal.id),
      montantVirement: "50",
    }));
    expect(res?.errors).toBeUndefined();
    const mouvement = await prisma.mouvement.findFirstOrThrow({ where: { associationId: jeu.associationId } });
    expect(mouvement.montant).toBe(50);
    expect(mouvement.journalDestinationId).toBe(autreJournal.id);
  });

  it("supprimer la dernière ligne d'un mouvement clôturé est refusé", async () => {
    const mouvement = await prisma.mouvement.create({
      data: {
        associationId: jeu.associationId, exerciceId: jeu.exerciceId, journalId: jeu.journalId,
        date: new Date("2026-03-15"), type: "depense", typeTransaction: "especes", montant: 10,
        ventilations: { create: [{ sousCategorieId: jeu.sousCategorieDepense, montant: 10 }] },
      },
    });
    await prisma.exercice.update({ where: { id: jeu.exerciceId }, data: { cloture: true } });

    const res = await supprimerMouvement(mouvement.id);
    expect(res.error).toBe("Cet exercice est clôturé : ce mouvement ne peut plus être supprimé.");
    expect(await prisma.mouvement.findUnique({ where: { id: mouvement.id } })).not.toBeNull();
  });
});
