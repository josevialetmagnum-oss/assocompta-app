import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { analyseParLignes } from "@/lib/analyse";
import { creerJeuComplet, type Jeu } from "../support/jeu-de-donnees";
import { verifierBaseDeTest, viderBase } from "../support/base-test";

async function mouvement(jeu: Jeu, type: "recette" | "depense", date: string, montant: number, dateBilan = date) {
  await prisma.mouvement.create({
    data: {
      associationId: jeu.associationId, exerciceId: jeu.exerciceId, journalId: jeu.journalId,
      date: new Date(date), dateBilan: new Date(dateBilan), type, typeTransaction: "especes", montant,
      ventilations: { create: [{ sousCategorieId: type === "recette" ? jeu.sousCategorieRecette : jeu.sousCategorieDepense, montant }] },
    },
  });
}

describe("analyse par lignes", () => {
  let jeu: Jeu;
  const du = new Date("2026-01-01");
  const au = new Date("2026-06-30");

  beforeEach(async () => {
    verifierBaseDeTest();
    await viderBase();
    jeu = await creerJeuComplet();
  });

  it("cumule recettes et dépenses de chaque ligne, avec la différence et le total", async () => {
    await mouvement(jeu, "recette", "2026-02-01", 80);
    await mouvement(jeu, "recette", "2026-03-01", 20);
    await mouvement(jeu, "depense", "2026-04-01", 30);

    const r = await analyseParLignes(jeu.associationId, du, au, [
      { sousCategorieRecetteId: jeu.sousCategorieRecette, sousCategorieDepenseId: jeu.sousCategorieDepense },
    ]);

    expect(r.lignes).toHaveLength(1);
    expect(r.lignes[0].recette?.total).toBe(100);
    expect(r.lignes[0].depense?.total).toBe(30);
    expect(r.lignes[0].difference).toBe(70);
    expect(r).toMatchObject({ totalRecettes: 100, totalDepenses: 30, difference: 70, doublons: [] });
  });

  it("une ligne peut ne porter qu'une recette ou qu'une dépense", async () => {
    await mouvement(jeu, "recette", "2026-02-01", 50);
    await mouvement(jeu, "depense", "2026-02-02", 20);

    const r = await analyseParLignes(jeu.associationId, du, au, [
      { sousCategorieRecetteId: jeu.sousCategorieRecette, sousCategorieDepenseId: null },
      { sousCategorieRecetteId: null, sousCategorieDepenseId: jeu.sousCategorieDepense },
    ]);

    expect(r.lignes.map((l) => l.difference)).toEqual([50, -20]);
    expect(r.difference).toBe(30);
  });

  it("seuls les mouvements dont la date bilan est dans la période comptent", async () => {
    await mouvement(jeu, "recette", "2026-02-01", 10);
    await mouvement(jeu, "recette", "2026-06-30", 5); // borne de fin incluse
    await mouvement(jeu, "recette", "2026-01-01", 1); // borne de début incluse
    await mouvement(jeu, "recette", "2026-07-01", 999); // après la période
    await mouvement(jeu, "recette", "2025-12-31", 999); // avant la période
    // date de saisie dans la période mais date bilan hors période : exclu
    await mouvement(jeu, "recette", "2026-03-01", 777, "2025-12-31");

    const r = await analyseParLignes(jeu.associationId, du, au, [
      { sousCategorieRecetteId: jeu.sousCategorieRecette, sousCategorieDepenseId: null },
    ]);
    expect(r.totalRecettes).toBe(16);
  });

  it("ignore une sous-catégorie d'une autre association", async () => {
    await mouvement(jeu, "recette", "2026-02-01", 100);
    const autre = await prisma.association.create({ data: { nom: "Autre association" } });
    const categorie = await prisma.categorie.create({ data: { associationId: autre.id, nom: "Dons", type: "recette" } });
    const sousCategorie = await prisma.sousCategorie.create({ data: { categorieId: categorie.id, nom: "Dons manuels" } });

    const r = await analyseParLignes(jeu.associationId, du, au, [
      { sousCategorieRecetteId: sousCategorie.id, sousCategorieDepenseId: null },
    ]);
    expect(r.lignes).toEqual([]);
    expect(r.totalRecettes).toBe(0);
  });

  it("refuse une dépense dans la colonne recette (et inversement)", async () => {
    await mouvement(jeu, "depense", "2026-02-01", 40);

    const r = await analyseParLignes(jeu.associationId, du, au, [
      { sousCategorieRecetteId: jeu.sousCategorieDepense, sousCategorieDepenseId: jeu.sousCategorieRecette },
    ]);
    expect(r.lignes).toEqual([]);
  });

  it("signale une sous-catégorie présente sur plusieurs lignes", async () => {
    await mouvement(jeu, "recette", "2026-02-01", 10);

    const r = await analyseParLignes(jeu.associationId, du, au, [
      { sousCategorieRecetteId: jeu.sousCategorieRecette, sousCategorieDepenseId: null },
      { sousCategorieRecetteId: jeu.sousCategorieRecette, sousCategorieDepenseId: null },
    ]);
    expect(r.doublons).toEqual(["Cotisations — Cotisations annuelles"]);
    expect(r.totalRecettes).toBe(20);
  });
});
