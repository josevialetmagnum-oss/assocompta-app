import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/association", async () => (await import("../support/contexte")).moduleAssociationDeTest());
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { prisma } from "@/lib/prisma";
import {
  dernierRapprochement,
  listerRapprochements,
  mouvementsDuRapprochement,
  supprimerDernierRapprochement,
  validerRapprochement,
} from "@/lib/rapprochement";
import { supprimerDernierRapprochementAction } from "@/app/rapprochement/actions";
import { creerJeuComplet, type Jeu } from "../support/jeu-de-donnees";
import { verifierBaseDeTest, viderBase } from "../support/base-test";
import { contexte } from "../support/contexte";

async function pointe(jeu: Jeu, date: string, montant: number, journalId = jeu.journalId) {
  return prisma.mouvement.create({
    data: {
      associationId: jeu.associationId, exerciceId: jeu.exerciceId, journalId,
      date: new Date(date), dateBilan: new Date(date), type: "recette", typeTransaction: "especes", montant, pointe: true,
      ventilations: { create: [{ sousCategorieId: jeu.sousCategorieRecette, montant }] },
    },
  });
}

describe("historique des rapprochements", () => {
  let jeu: Jeu;

  beforeEach(async () => {
    verifierBaseDeTest();
    await viderBase();
    jeu = await creerJeuComplet();
    contexte.associationId = jeu.associationId;
    contexte.lectureSeule = false;
  });

  it("liste les rapprochements du plus récent au plus ancien, avec leur nombre de mouvements", async () => {
    await pointe(jeu, "2026-01-10", 50);
    await pointe(jeu, "2026-01-20", 30);
    await validerRapprochement(jeu.associationId, jeu.journalId, new Date("2026-01-31"), 80);
    await pointe(jeu, "2026-02-10", 20);
    await validerRapprochement(jeu.associationId, jeu.journalId, new Date("2026-02-28"), 100);

    const liste = await listerRapprochements(jeu.associationId, jeu.journalId);
    expect(liste.map((r) => [r.date.toISOString().slice(0, 10), r.solde, r.nombreMouvements])).toEqual([
      ["2026-02-28", 100, 1],
      ["2026-01-31", 80, 2],
    ]);
    // Le premier de la liste est bien celui que la suppression viserait.
    expect(liste[0].id).toBe((await dernierRapprochement(jeu.associationId, jeu.journalId))!.id);
  });

  it("ne liste que les rapprochements du compte demandé et de l'association", async () => {
    const banque = await prisma.journal.create({ data: { associationId: jeu.associationId, nom: "Banque" } });
    await pointe(jeu, "2026-01-10", 50);
    await validerRapprochement(jeu.associationId, jeu.journalId, new Date("2026-01-31"), 50);
    await pointe(jeu, "2026-01-12", 10, banque.id);
    await validerRapprochement(jeu.associationId, banque.id, new Date("2026-01-31"), 10);

    expect(await listerRapprochements(jeu.associationId, jeu.journalId)).toHaveLength(1);
    expect(await listerRapprochements(jeu.associationId, banque.id)).toHaveLength(1);

    const autre = await prisma.association.create({ data: { nom: "Autre association" } });
    expect(await listerRapprochements(autre.id, jeu.journalId)).toEqual([]);
  });

  it("le détail d'un rapprochement donne ses mouvements, jamais ceux d'une autre association", async () => {
    const m = await pointe(jeu, "2026-01-10", 50);
    await validerRapprochement(jeu.associationId, jeu.journalId, new Date("2026-01-31"), 50);
    const [r] = await listerRapprochements(jeu.associationId, jeu.journalId);

    expect((await mouvementsDuRapprochement(jeu.associationId, r.id)).map((x) => x.id)).toEqual([m.id]);
    const autre = await prisma.association.create({ data: { nom: "Autre association" } });
    expect(await mouvementsDuRapprochement(autre.id, r.id)).toEqual([]);
  });

  it("deux rapprochements à la même date : le plus récemment validé est le dernier", async () => {
    await pointe(jeu, "2026-01-10", 50);
    await validerRapprochement(jeu.associationId, jeu.journalId, new Date("2026-01-31"), 50);
    await pointe(jeu, "2026-01-15", 5);
    await validerRapprochement(jeu.associationId, jeu.journalId, new Date("2026-01-31"), 55);

    const liste = await listerRapprochements(jeu.associationId, jeu.journalId);
    expect(liste.map((r) => r.solde)).toEqual([55, 50]);
    expect((await dernierRapprochement(jeu.associationId, jeu.journalId))!.solde).toBe(55);
  });

  it("refuse de supprimer un rapprochement qui n'est plus le dernier (page périmée)", async () => {
    await pointe(jeu, "2026-01-10", 50);
    await validerRapprochement(jeu.associationId, jeu.journalId, new Date("2026-01-31"), 50);
    const [ancien] = await listerRapprochements(jeu.associationId, jeu.journalId);
    await pointe(jeu, "2026-02-10", 20);
    await validerRapprochement(jeu.associationId, jeu.journalId, new Date("2026-02-28"), 70);

    const res = await supprimerDernierRapprochement(jeu.associationId, jeu.journalId, ancien.id);
    expect(res.ok).toBe(false);
    expect(await prisma.rapprochement.count()).toBe(2);
    expect(await prisma.mouvement.count({ where: { rapprochementId: { not: null } } })).toBe(2);
  });

  it("supprime le dernier quand l'identifiant correspond, et seulement lui", async () => {
    await pointe(jeu, "2026-01-10", 50);
    await validerRapprochement(jeu.associationId, jeu.journalId, new Date("2026-01-31"), 50);
    await pointe(jeu, "2026-02-10", 20);
    await validerRapprochement(jeu.associationId, jeu.journalId, new Date("2026-02-28"), 70);
    const [dernier] = await listerRapprochements(jeu.associationId, jeu.journalId);

    expect(await supprimerDernierRapprochementAction(jeu.journalId, dernier.id)).toEqual({});
    const reste = await listerRapprochements(jeu.associationId, jeu.journalId);
    expect(reste.map((r) => r.solde)).toEqual([50]);
    expect(reste[0].nombreMouvements).toBe(1);
  });

  it("un compte en lecture seule ne peut pas supprimer", async () => {
    await pointe(jeu, "2026-01-10", 50);
    await validerRapprochement(jeu.associationId, jeu.journalId, new Date("2026-01-31"), 50);
    const [r] = await listerRapprochements(jeu.associationId, jeu.journalId);
    contexte.lectureSeule = true;
    await expect(supprimerDernierRapprochementAction(jeu.journalId, r.id)).rejects.toThrow();
    expect(await prisma.rapprochement.count()).toBe(1);
  });
});
