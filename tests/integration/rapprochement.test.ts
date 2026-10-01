import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/association", async () => (await import("../support/contexte")).moduleAssociationDeTest());

import { prisma } from "@/lib/prisma";
import {
  dernierRapprochement,
  ecartRapprochement,
  soldeBaseRapprochement,
  supprimerDernierRapprochement,
  validerRapprochement,
} from "@/lib/rapprochement";
import { creerJeuComplet, type Jeu } from "../support/jeu-de-donnees";
import { verifierBaseDeTest, viderBase } from "../support/base-test";

describe("rapprochement bancaire par étapes", () => {
  let jeu: Jeu;

  beforeEach(async () => {
    verifierBaseDeTest();
    await viderBase();
    jeu = await creerJeuComplet();
  });

  it("sans rapprochement antérieur, la base est le solde d'ouverture du journal, sans date", async () => {
    await prisma.journal.update({ where: { id: jeu.journalId }, data: { soldeInitial: 200 } });
    expect(await soldeBaseRapprochement(jeu.associationId, jeu.journalId)).toEqual({ date: null, solde: 200 });
  });

  it("l'écart tient compte du solde de base et diminue à mesure que les mouvements sont pointés", async () => {
    const m1 = await prisma.mouvement.create({
      data: {
        associationId: jeu.associationId, exerciceId: jeu.exerciceId, journalId: jeu.journalId,
        date: new Date("2026-02-01"), dateBilan: new Date("2026-02-01"), type: "recette", typeTransaction: "especes", montant: 50,
        ventilations: { create: [{ sousCategorieId: jeu.sousCategorieRecette, montant: 50 }] },
      },
    });
    // Écart initial : 50 (relevé) - 0 (base) - 0 (rien de pointé) = 50.
    expect(await ecartRapprochement(jeu.associationId, jeu.journalId, new Date("2026-02-28"), 50)).toBe(50);

    await prisma.mouvement.update({ where: { id: m1.id }, data: { pointe: true, pointeLe: new Date() } });
    // Une fois pointé : 50 - 0 - 50 = 0.
    expect(await ecartRapprochement(jeu.associationId, jeu.journalId, new Date("2026-02-28"), 50)).toBe(0);
  });

  it("ignore les mouvements pointés datés après la date du relevé", async () => {
    await prisma.mouvement.create({
      data: {
        associationId: jeu.associationId, exerciceId: jeu.exerciceId, journalId: jeu.journalId,
        date: new Date("2026-03-01"), dateBilan: new Date("2026-03-01"), type: "recette", typeTransaction: "especes", montant: 999, pointe: true,
        ventilations: { create: [{ sousCategorieId: jeu.sousCategorieRecette, montant: 999 }] },
      },
    });
    expect(await ecartRapprochement(jeu.associationId, jeu.journalId, new Date("2026-02-28"), 0)).toBe(0);
  });

  it("valide : crée le rapprochement et rattache les mouvements pointés qualifiants", async () => {
    const m1 = await prisma.mouvement.create({
      data: {
        associationId: jeu.associationId, exerciceId: jeu.exerciceId, journalId: jeu.journalId,
        date: new Date("2026-02-01"), dateBilan: new Date("2026-02-01"), type: "recette", typeTransaction: "especes", montant: 50, pointe: true,
        ventilations: { create: [{ sousCategorieId: jeu.sousCategorieRecette, montant: 50 }] },
      },
    });

    const res = await validerRapprochement(jeu.associationId, jeu.journalId, new Date("2026-02-28"), 50);
    expect(res).toEqual({ ok: true });

    const relu = await prisma.mouvement.findUniqueOrThrow({ where: { id: m1.id } });
    expect(relu.rapprochementId).not.toBeNull();

    const dernier = await dernierRapprochement(jeu.associationId, jeu.journalId);
    expect(dernier).toEqual({ id: expect.any(Number), date: new Date("2026-02-28"), solde: 50 });

    const base = await soldeBaseRapprochement(jeu.associationId, jeu.journalId);
    expect(base).toEqual({ date: new Date("2026-02-28"), solde: 50 });
  });

  it("refuse de valider si l'écart n'est pas nul", async () => {
    const res = await validerRapprochement(jeu.associationId, jeu.journalId, new Date("2026-02-28"), 999);
    expect(res).toEqual({ ok: false, erreur: "L'écart doit être nul pour valider (actuellement 999.00 €)." });
    expect(await prisma.rapprochement.count()).toBe(0);
  });

  it("refuse une date de relevé antérieure au dernier rapprochement", async () => {
    await validerRapprochement(jeu.associationId, jeu.journalId, new Date("2026-02-28"), 0);
    const res = await validerRapprochement(jeu.associationId, jeu.journalId, new Date("2026-01-01"), 0);
    expect(res.ok).toBe(false);
  });

  it("ne rattache pas un mouvement déjà rattaché à un rapprochement antérieur", async () => {
    const m1 = await prisma.mouvement.create({
      data: {
        associationId: jeu.associationId, exerciceId: jeu.exerciceId, journalId: jeu.journalId,
        date: new Date("2026-02-01"), dateBilan: new Date("2026-02-01"), type: "recette", typeTransaction: "especes", montant: 50, pointe: true,
        ventilations: { create: [{ sousCategorieId: jeu.sousCategorieRecette, montant: 50 }] },
      },
    });
    await validerRapprochement(jeu.associationId, jeu.journalId, new Date("2026-02-28"), 50);

    const m2 = await prisma.mouvement.create({
      data: {
        associationId: jeu.associationId, exerciceId: jeu.exerciceId, journalId: jeu.journalId,
        date: new Date("2026-03-05"), dateBilan: new Date("2026-03-05"), type: "recette", typeTransaction: "especes", montant: 30, pointe: true,
        ventilations: { create: [{ sousCategorieId: jeu.sousCategorieRecette, montant: 30 }] },
      },
    });
    const res = await validerRapprochement(jeu.associationId, jeu.journalId, new Date("2026-03-31"), 80);
    expect(res).toEqual({ ok: true });

    const rapprochements = await prisma.rapprochement.findMany({ orderBy: { date: "asc" } });
    expect(rapprochements).toHaveLength(2);
    const premier = await prisma.mouvement.findUniqueOrThrow({ where: { id: m1.id } });
    const second = await prisma.mouvement.findUniqueOrThrow({ where: { id: m2.id } });
    expect(premier.rapprochementId).toBe(rapprochements[0].id);
    expect(second.rapprochementId).toBe(rapprochements[1].id);
  });

  it("supprime le dernier rapprochement : dépointe ses mouvements, jamais ceux d'un rapprochement antérieur", async () => {
    const m1 = await prisma.mouvement.create({
      data: {
        associationId: jeu.associationId, exerciceId: jeu.exerciceId, journalId: jeu.journalId,
        date: new Date("2026-02-01"), dateBilan: new Date("2026-02-01"), type: "recette", typeTransaction: "especes", montant: 50, pointe: true,
        ventilations: { create: [{ sousCategorieId: jeu.sousCategorieRecette, montant: 50 }] },
      },
    });
    await validerRapprochement(jeu.associationId, jeu.journalId, new Date("2026-02-28"), 50);

    const m2 = await prisma.mouvement.create({
      data: {
        associationId: jeu.associationId, exerciceId: jeu.exerciceId, journalId: jeu.journalId,
        date: new Date("2026-03-05"), dateBilan: new Date("2026-03-05"), type: "recette", typeTransaction: "especes", montant: 30, pointe: true,
        ventilations: { create: [{ sousCategorieId: jeu.sousCategorieRecette, montant: 30 }] },
      },
    });
    await validerRapprochement(jeu.associationId, jeu.journalId, new Date("2026-03-31"), 80);

    const res = await supprimerDernierRapprochement(jeu.associationId, jeu.journalId);
    expect(res).toEqual({ ok: true });

    const premier = await prisma.mouvement.findUniqueOrThrow({ where: { id: m1.id } });
    expect(premier.rapprochementId).not.toBeNull();
    expect(premier.pointe).toBe(true);

    const second = await prisma.mouvement.findUniqueOrThrow({ where: { id: m2.id } });
    expect(second.rapprochementId).toBeNull();
    expect(second.pointe).toBe(false);

    const base = await soldeBaseRapprochement(jeu.associationId, jeu.journalId);
    expect(base.solde).toBe(50);
  });

  it("refuse de supprimer s'il n'y a aucun rapprochement", async () => {
    const res = await supprimerDernierRapprochement(jeu.associationId, jeu.journalId);
    expect(res).toEqual({ ok: false, erreur: "Aucun rapprochement à supprimer pour ce journal." });
  });

  it("un virement interne compte pour les deux journaux qu'il touche", async () => {
    const autreJournal = await prisma.journal.create({ data: { associationId: jeu.associationId, nom: "Banque" } });
    const m = await prisma.mouvement.create({
      data: {
        associationId: jeu.associationId, exerciceId: jeu.exerciceId, journalId: jeu.journalId,
        journalDestinationId: autreJournal.id, date: new Date("2026-02-01"), dateBilan: new Date("2026-02-01"),
        type: "virement_interne", typeTransaction: "virement", montant: 50, pointe: true,
      },
    });
    expect(await ecartRapprochement(jeu.associationId, jeu.journalId, new Date("2026-02-28"), -50)).toBe(0);
    expect(await ecartRapprochement(jeu.associationId, autreJournal.id, new Date("2026-02-28"), 50)).toBe(0);

    await validerRapprochement(jeu.associationId, jeu.journalId, new Date("2026-02-28"), -50);
    const relu = await prisma.mouvement.findUniqueOrThrow({ where: { id: m.id } });
    expect(relu.rapprochementId).not.toBeNull();
  });
});
