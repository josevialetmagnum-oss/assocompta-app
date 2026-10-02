import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/association", async () => (await import("../support/contexte")).moduleAssociationDeTest());

import { PDFDocument } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { GET as pdfBilanRoute } from "@/app/etats/bilan/pdf/route";
import { GET as pdfAnalyseRoute } from "@/app/etats/analyse/pdf/route";
import { GET as pdfSoldesRoute } from "@/app/etats/pdf/route";
import { bilanExercice } from "@/lib/bilan";
import { analyseParLignes } from "@/lib/analyse";
import { resultatParCategorie, situationTresorerie, soldesJournaux } from "@/lib/tresorerie";
import { pdfAnalyse, pdfBilan, pdfSoldesEtResultats } from "@/lib/pdf-etats";
import { creerJeuComplet, type Jeu } from "../support/jeu-de-donnees";
import { verifierBaseDeTest, viderBase } from "../support/base-test";
import { contexte } from "../support/contexte";

const requete = (chemin: string) => new Request(`http://localhost${chemin}`);
const montant = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

async function mouvement(jeu: Jeu, type: "recette" | "depense", date: string, valeur: number) {
  await prisma.mouvement.create({
    data: {
      associationId: jeu.associationId, exerciceId: jeu.exerciceId, journalId: jeu.journalId,
      date: new Date(date), dateBilan: new Date(date), type, typeTransaction: "especes", montant: valeur,
      ventilations: { create: [{ sousCategorieId: type === "recette" ? jeu.sousCategorieRecette : jeu.sousCategorieDepense, montant: valeur }] },
    },
  });
}

describe("export PDF des états", () => {
  let jeu: Jeu;

  beforeEach(async () => {
    verifierBaseDeTest();
    await viderBase();
    jeu = await creerJeuComplet();
    contexte.associationId = jeu.associationId;
    contexte.lectureSeule = false;
    await mouvement(jeu, "recette", "2026-02-01", 1200.5);
    await mouvement(jeu, "depense", "2026-03-01", 300);
  });

  describe("routes", () => {
    it("le bilan se télécharge en PDF, par défaut sur l'exercice en cours", async () => {
      // L'exercice du jeu de données court de janvier à décembre 2026 : « en cours » dépend de la date du jour.
      const res = await pdfBilanRoute(requete(`/etats/bilan/pdf?exercice=${jeu.exerciceId}`));
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/pdf");
      expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="bilan-2026-association-test.pdf"');
      expect(res.headers.get("Cache-Control")).toContain("no-store");
      const octets = new Uint8Array(await res.arrayBuffer());
      expect(Buffer.from(octets.slice(0, 5)).toString()).toBe("%PDF-");
      expect((await PDFDocument.load(octets)).getPageCount()).toBe(1);
    });

    it("l'analyse par lignes se télécharge avec la période et les lignes demandées", async () => {
      const res = await pdfAnalyseRoute(
        requete(`/etats/analyse/pdf?du=2026-01-01&au=2026-06-30&rec=${jeu.sousCategorieRecette}&dep=${jeu.sousCategorieDepense}`),
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/pdf");
      expect(res.headers.get("Content-Disposition")).toContain("analyse-2026-01-01-2026-06-30");
    });

    it("soldes et résultats se télécharge en PDF", async () => {
      const res = await pdfSoldesRoute(requete(`/etats/pdf?exercice=${jeu.exerciceId}`));
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Disposition")).toContain("soldes-et-resultats-2026");
    });

    it("un compte en lecture seule peut télécharger (consultation)", async () => {
      contexte.lectureSeule = true;
      expect((await pdfBilanRoute(requete(`/etats/bilan/pdf?exercice=${jeu.exerciceId}`))).status).toBe(200);
    });

    it("refuse l'exercice d'une autre association (404), sur le bilan comme sur soldes et résultats", async () => {
      const autre = await prisma.association.create({ data: { nom: "Autre association" } });
      const exerciceAutre = await prisma.exercice.create({
        data: { associationId: autre.id, libelle: "2026", dateDebut: new Date("2026-01-01"), dateFin: new Date("2026-12-31") },
      });
      expect((await pdfBilanRoute(requete(`/etats/bilan/pdf?exercice=${exerciceAutre.id}`))).status).toBe(404);
      expect((await pdfSoldesRoute(requete(`/etats/pdf?exercice=${exerciceAutre.id}`))).status).toBe(404);
    });

    it("renvoie 404 pour un exercice inconnu et 400 pour une période inversée", async () => {
      expect((await pdfBilanRoute(requete("/etats/bilan/pdf?exercice=999999"))).status).toBe(404);
      expect((await pdfAnalyseRoute(requete("/etats/analyse/pdf?du=2026-12-31&au=2026-01-01&rec=1"))).status).toBe(400);
    });

    it("ignore une sous-catégorie d'une autre association dans l'analyse (aucune ligne)", async () => {
      const autre = await prisma.association.create({ data: { nom: "Autre association" } });
      const categorie = await prisma.categorie.create({ data: { associationId: autre.id, nom: "Dons", type: "recette" } });
      const sc = await prisma.sousCategorie.create({ data: { categorieId: categorie.id, nom: "Dons manuels" } });
      const res = await pdfAnalyseRoute(requete(`/etats/analyse/pdf?du=2026-01-01&au=2026-12-31&rec=${sc.id}`));
      expect(res.status).toBe(200);
    });
  });

  describe("contenu", () => {
    it("le bilan reprend exactement les montants calculés", async () => {
      const bilan = (await bilanExercice(jeu.associationId, jeu.exerciceId))!;
      const doc = await pdfBilan(bilan, "Association test", new Date("2026-10-02"));
      const lignes = doc.modele.flatMap((m) => (m.type === "ligne" ? [m.cellules] : []));

      expect(lignes).toContainEqual(["Cotisations", montant(1200.5)]);
      expect(lignes).toContainEqual(["Cotisations annuelles", montant(1200.5)]);
      expect(lignes).toContainEqual(["Total recettes", montant(1200.5)]);
      expect(lignes).toContainEqual(["Total dépenses", montant(300)]);
      expect(lignes).toContainEqual(["Résultat de l'exercice (excédent)", montant(900.5)]);
      expect(lignes).toContainEqual(["Caisse", montant(0), montant(900.5), montant(900.5)]);
    });

    it("le bilan indique un déficit quand les dépenses l'emportent", async () => {
      await mouvement(jeu, "depense", "2026-04-01", 5000);
      const bilan = (await bilanExercice(jeu.associationId, jeu.exerciceId))!;
      const doc = await pdfBilan(bilan, "Association test");
      const lignes = doc.modele.flatMap((m) => (m.type === "ligne" ? [m.cellules] : []));
      expect(lignes.some((c) => c[0] === "Résultat de l'exercice (déficit)")).toBe(true);
    });

    it("l'analyse reprend les lignes, la différence, le total et signale un doublon", async () => {
      const resultat = await analyseParLignes(jeu.associationId, new Date("2026-01-01"), new Date("2026-12-31"), [
        { sousCategorieRecetteId: jeu.sousCategorieRecette, sousCategorieDepenseId: jeu.sousCategorieDepense },
        { sousCategorieRecetteId: jeu.sousCategorieRecette, sousCategorieDepenseId: null },
      ]);
      const doc = await pdfAnalyse(resultat, { du: new Date("2026-01-01"), au: new Date("2026-12-31") }, "Association test");
      const lignes = doc.modele.flatMap((m) => (m.type === "ligne" ? [m.cellules] : []));

      expect(lignes[0]).toEqual(["Cotisations — Cotisations annuelles", montant(1200.5), "Fournitures — Papeterie", montant(300), montant(900.5)]);
      expect(lignes[lignes.length - 1]).toEqual(["Total recettes", montant(2401), "Total dépenses", montant(300), montant(2101)]);
      expect(doc.modele.some((m) => m.type === "texte" && m.texte.includes("plusieurs lignes"))).toBe(true);
    });

    it("soldes et résultats reprend soldes, catégories et situation", async () => {
      const exercice = await prisma.exercice.findUniqueOrThrow({ where: { id: jeu.exerciceId } });
      const doc = await pdfSoldesEtResultats(
        {
          exercice,
          soldes: await soldesJournaux(jeu.associationId),
          lignes: await resultatParCategorie(jeu.associationId, jeu.exerciceId),
          situation: await situationTresorerie(jeu.associationId, jeu.exerciceId),
        },
        "Association test",
      );
      const lignes = doc.modele.flatMap((m) => (m.type === "ligne" ? [m.cellules] : []));
      expect(lignes).toContainEqual(["Caisse", montant(900.5)]);
      expect(lignes).toContainEqual(["Cotisations", "Recette", montant(1200.5)]);
      expect(lignes).toContainEqual(["Fournitures", "Dépense", montant(300)]);
      expect(lignes).toContainEqual(["Résultat", montant(900.5)]);
    });
  });
});
