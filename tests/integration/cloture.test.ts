import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/association", async () => (await import("../support/contexte")).moduleAssociationDeTest());
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { prisma } from "@/lib/prisma";
import { cloturerExerciceAssociation, rouvrirExerciceAssociation } from "@/lib/cloture";
import { bilanExercice } from "@/lib/bilan";
import { autoriseSoldesOuverture } from "@/lib/tresorerie";
import { cloturerExercice, rouvrirExercice } from "@/app/parametrage/actions";
import { creerJeuComplet, type Jeu } from "../support/jeu-de-donnees";
import { verifierBaseDeTest, viderBase } from "../support/base-test";
import { contexte } from "../support/contexte";

async function recette(jeu: Jeu, exerciceId: number, date: string, montant: number, journalId = jeu.journalId) {
  await prisma.mouvement.create({
    data: {
      associationId: jeu.associationId, exerciceId, journalId,
      date: new Date(date), dateBilan: new Date(date), type: "recette", typeTransaction: "especes", montant,
      ventilations: { create: [{ sousCategorieId: jeu.sousCategorieRecette, montant }] },
    },
  });
}

describe("clôture et réouverture d'un exercice", () => {
  let jeu: Jeu;
  let ex2025: number;
  let ex2026: number;

  beforeEach(async () => {
    verifierBaseDeTest();
    await viderBase();
    jeu = await creerJeuComplet(); // exercice 2026 déjà créé
    contexte.associationId = jeu.associationId;
    contexte.lectureSeule = false;
    ex2026 = jeu.exerciceId;
    ex2025 = (
      await prisma.exercice.create({
        data: { associationId: jeu.associationId, libelle: "2025", dateDebut: new Date("2025-01-01"), dateFin: new Date("2025-12-31") },
      })
    ).id;
    await prisma.journal.update({ where: { id: jeu.journalId }, data: { soldeInitial: 100 } });
  });

  it("fige le solde de chaque compte à la clôture et marque l'exercice clôturé", async () => {
    const banque = await prisma.journal.create({ data: { associationId: jeu.associationId, nom: "Banque" } });
    await recette(jeu, ex2025, "2025-03-01", 50);
    await recette(jeu, ex2025, "2025-04-01", 20, banque.id);

    expect(await cloturerExerciceAssociation(jeu.associationId, ex2025)).toEqual({ ok: true });

    const exercice = await prisma.exercice.findUniqueOrThrow({ where: { id: ex2025 } });
    expect(exercice.cloture).toBe(true);
    expect(exercice.clotureLe).not.toBeNull();
    const soldes = await prisma.soldeCloture.findMany({ where: { exerciceId: ex2025 }, orderBy: { journalId: "asc" } });
    expect(soldes.map((s) => [s.journalId, s.solde])).toEqual([[jeu.journalId, 150], [banque.id, 20]]);
  });

  it("reporte le solde figé en ouverture de l'exercice suivant (et non un recalcul)", async () => {
    await recette(jeu, ex2025, "2025-03-01", 50);
    await cloturerExerciceAssociation(jeu.associationId, ex2025);

    let bilan = await bilanExercice(jeu.associationId, ex2026);
    expect(bilan!.comptes[0]).toMatchObject({ ouverture: 150, variation: 0, cloture: 150 });

    // Preuve que c'est bien le solde figé qui sert : on l'altère, l'ouverture suit.
    await prisma.soldeCloture.updateMany({ where: { exerciceId: ex2025 }, data: { solde: 999 } });
    bilan = await bilanExercice(jeu.associationId, ex2026);
    expect(bilan!.comptes[0].ouverture).toBe(999);
  });

  it("l'enchaînement reste cohérent sur plusieurs exercices et pour un compte créé après la clôture", async () => {
    await recette(jeu, ex2025, "2025-03-01", 50);
    await cloturerExerciceAssociation(jeu.associationId, ex2025);
    await recette(jeu, ex2026, "2026-03-01", 30);
    const apres = await prisma.journal.create({ data: { associationId: jeu.associationId, nom: "Nouveau compte", soldeInitial: 5 } });

    const bilan = await bilanExercice(jeu.associationId, ex2026);
    expect(bilan!.comptes.map((c) => [c.nom, c.ouverture, c.cloture])).toEqual([
      ["Caisse", 150, 180],
      ["Nouveau compte", 5, 5],
    ]);

    await cloturerExerciceAssociation(jeu.associationId, ex2026);
    const ex2027 = await prisma.exercice.create({
      data: { associationId: jeu.associationId, libelle: "2027", dateDebut: new Date("2027-01-01"), dateFin: new Date("2027-12-31") },
    });
    const bilan2027 = await bilanExercice(jeu.associationId, ex2027.id);
    expect(bilan2027!.comptes.map((c) => [c.nom, c.ouverture])).toEqual([["Caisse", 180], ["Nouveau compte", 5]]);
    expect(apres.id).toBeGreaterThan(0);
  });

  it("refuse de clôturer un exercice tant qu'un exercice antérieur est ouvert", async () => {
    const res = await cloturerExerciceAssociation(jeu.associationId, ex2026);
    expect(res.ok).toBe(false);
    expect(!res.ok && res.erreur).toContain("2025");
    expect((await prisma.exercice.findUniqueOrThrow({ where: { id: ex2026 } })).cloture).toBe(false);
    expect(await prisma.soldeCloture.count()).toBe(0);
  });

  it("refuse de clôturer deux fois", async () => {
    await cloturerExerciceAssociation(jeu.associationId, ex2025);
    const res = await cloturerExerciceAssociation(jeu.associationId, ex2025);
    expect(res.ok).toBe(false);
  });

  it("la réouverture supprime les soldes figés et rouvre aussi les exercices suivants clôturés", async () => {
    await recette(jeu, ex2025, "2025-03-01", 50);
    await cloturerExerciceAssociation(jeu.associationId, ex2025);
    await cloturerExerciceAssociation(jeu.associationId, ex2026);
    expect(await prisma.soldeCloture.count()).toBe(2);

    const res = await rouvrirExerciceAssociation(jeu.associationId, ex2025);
    expect(res).toEqual({ ok: true, rouverts: ["2025", "2026"] });
    expect(await prisma.soldeCloture.count()).toBe(0);
    const exercices = await prisma.exercice.findMany({ where: { associationId: jeu.associationId } });
    expect(exercices.every((e) => !e.cloture && e.clotureLe === null)).toBe(true);
  });

  it("rouvrir un exercice laisse clôturés les exercices antérieurs", async () => {
    await cloturerExerciceAssociation(jeu.associationId, ex2025);
    await cloturerExerciceAssociation(jeu.associationId, ex2026);

    const res = await rouvrirExerciceAssociation(jeu.associationId, ex2026);
    expect(res).toEqual({ ok: true, rouverts: ["2026"] });
    expect((await prisma.exercice.findUniqueOrThrow({ where: { id: ex2025 } })).cloture).toBe(true);
    expect(await prisma.soldeCloture.count({ where: { exerciceId: ex2025 } })).toBe(1);
  });

  it("après réouverture, les nouveaux mouvements sont de nouveau pris en compte à la clôture suivante", async () => {
    await cloturerExerciceAssociation(jeu.associationId, ex2025);
    await rouvrirExerciceAssociation(jeu.associationId, ex2025);
    await recette(jeu, ex2025, "2025-05-01", 40);
    await cloturerExerciceAssociation(jeu.associationId, ex2025);

    const bilan = await bilanExercice(jeu.associationId, ex2026);
    expect(bilan!.comptes[0].ouverture).toBe(140);
  });

  it("n'agit jamais sur l'exercice d'une autre association", async () => {
    const autre = await prisma.association.create({ data: { nom: "Autre association" } });
    const exAutre = await prisma.exercice.create({
      data: { associationId: autre.id, libelle: "2025", dateDebut: new Date("2025-01-01"), dateFin: new Date("2025-12-31") },
    });
    const exAutreCloture = await prisma.exercice.create({
      data: { associationId: autre.id, libelle: "2024", dateDebut: new Date("2024-01-01"), dateFin: new Date("2024-12-31"), cloture: true, clotureLe: new Date() },
    });
    expect((await cloturerExerciceAssociation(jeu.associationId, exAutre.id)).ok).toBe(false);
    // Déjà clôturé : seul le cloisonnement par association peut empêcher cette réouverture.
    expect((await rouvrirExerciceAssociation(jeu.associationId, exAutreCloture.id)).ok).toBe(false);
    expect((await prisma.exercice.findUniqueOrThrow({ where: { id: exAutre.id } })).cloture).toBe(false);
    expect((await prisma.exercice.findUniqueOrThrow({ where: { id: exAutreCloture.id } })).cloture).toBe(true);
  });

  it("un compte en lecture seule ne peut ni clôturer ni rouvrir", async () => {
    contexte.lectureSeule = true;
    await expect(cloturerExercice(ex2025)).rejects.toThrow();
    await expect(rouvrirExercice(ex2025)).rejects.toThrow();
    expect((await prisma.exercice.findUniqueOrThrow({ where: { id: ex2025 } })).cloture).toBe(false);
  });

  it("l'action renvoie l'erreur au lieu de lever une exception", async () => {
    expect(await cloturerExercice(ex2026)).toEqual({ error: expect.stringContaining("2025") });
    expect(await cloturerExercice(ex2025)).toEqual({});
    expect(await rouvrirExercice(ex2026)).toEqual({ error: "Cet exercice n'est pas clôturé." });
  });

  it("ne propose plus de saisir les soldes d'ouverture quand l'exercice précédent est clôturé", async () => {
    // 2026 est le plus récent exercice, vide et ouvert : saisie autorisée.
    expect(await autoriseSoldesOuverture(jeu.associationId)).toBe(true);
    await cloturerExerciceAssociation(jeu.associationId, ex2025);
    await cloturerExerciceAssociation(jeu.associationId, ex2026);
    expect(await autoriseSoldesOuverture(jeu.associationId)).toBe(false);
  });
});
