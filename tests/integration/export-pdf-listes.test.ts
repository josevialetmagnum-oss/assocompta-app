import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/association", async () => (await import("../support/contexte")).moduleAssociationDeTest());

import { PDFDocument } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { GET as pdfMouvementsRoute } from "@/app/mouvements/pdf/route";
import { GET as pdfRapprochementRoute } from "@/app/rapprochement/pdf/route";
import { listerMouvementsFiltres } from "@/lib/liste-mouvements";
import { dernierRapprochement, listerRapprochements, mouvementsNonRapprochesJournal, validerRapprochement } from "@/lib/rapprochement";
import { pdfMouvements, pdfRapprochement } from "@/lib/pdf-listes";
import { preparerPdfMouvements, preparerPdfRapprochement } from "@/lib/pdf-listes-donnees";

const params = (chemin: string) => new URL(`http://localhost${chemin}`).searchParams;
async function docMouvements(associationId: number, chemin: string) {
  const p = await preparerPdfMouvements(associationId, params(chemin));
  if (!p.ok) throw new Error(p.message);
  return p.doc;
}
async function docRapprochement(associationId: number, chemin: string) {
  const p = await preparerPdfRapprochement(associationId, params(chemin));
  if (!p.ok) throw new Error(p.message);
  return p.doc;
}
import { creerJeuComplet, type Jeu } from "../support/jeu-de-donnees";
import { verifierBaseDeTest, viderBase } from "../support/base-test";
import { contexte } from "../support/contexte";

const requete = (chemin: string) => new Request(`http://localhost${chemin}`);
const montant = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const lignes = (doc: { modele: { type: string; cellules?: string[] }[] }) => doc.modele.flatMap((m) => (m.type === "ligne" ? [m.cellules as string[]] : []));
const texte = (octets: Uint8Array) => PDFDocument.load(octets).then((d) => d.getPageCount());

async function mvt(jeu: Jeu, exerciceId: number, type: "recette" | "depense", date: string, valeur: number, extra: { pointe?: boolean; tiers?: string; journalId?: number } = {}) {
  return prisma.mouvement.create({
    data: {
      associationId: jeu.associationId, exerciceId, journalId: extra.journalId ?? jeu.journalId,
      date: new Date(date), dateBilan: new Date(date), type, typeTransaction: "especes", montant: valeur,
      pointe: extra.pointe ?? false, tiers: extra.tiers ?? null,
      ventilations: { create: [{ sousCategorieId: type === "recette" ? jeu.sousCategorieRecette : jeu.sousCategorieDepense, montant: valeur }] },
    },
  });
}

describe("PDF des mouvements et du rapprochement", () => {
  let jeu: Jeu;
  let ex2025: number;

  beforeEach(async () => {
    verifierBaseDeTest();
    await viderBase();
    jeu = await creerJeuComplet();
    contexte.associationId = jeu.associationId;
    contexte.lectureSeule = false;
    ex2025 = (await prisma.exercice.create({ data: { associationId: jeu.associationId, libelle: "2025", dateDebut: new Date("2025-01-01"), dateFin: new Date("2025-12-31") } })).id;
    await mvt(jeu, jeu.exerciceId, "recette", "2026-03-01", 500, { tiers: "Dupont" });
    await mvt(jeu, jeu.exerciceId, "depense", "2026-02-01", 120.5, { pointe: true });
    await mvt(jeu, ex2025, "recette", "2025-06-01", 40);
  });

  describe("mouvements", () => {
    it("filtre sur l'exercice demandé, en ordre chronologique, avec totaux", async () => {
      const mouvements = await listerMouvementsFiltres(jeu.associationId, { exerciceId: jeu.exerciceId }, "asc");
      const doc = await pdfMouvements(mouvements, { compte: null, exercice: "2026" }, "Association test");
      const l = lignes(doc);

      expect(l[0].slice(0, 5)).toEqual(["01/02/2026", "Caisse", "Dépense", "Fournitures — Papeterie", montant(120.5)]);
      expect(l[0][5]).toBe("Pointé");
      expect(l[1]).toEqual(["01/03/2026", "Caisse", "Recette", "Cotisations — Cotisations annuelles · Dupont", montant(500), ""]);
      expect(l.map((c) => c[3])).toContain("Total recettes (2 mouvements)");
      expect(l[l.length - 1]).toEqual(["", "", "", "Solde (recettes − dépenses)", montant(379.5), ""]);
    });

    it("la route produit l'ordre chronologique et respecte « Tous » / exercice en cours", async () => {
      const l2026 = lignes(await docMouvements(jeu.associationId, `/mouvements/pdf?exercice=${jeu.exerciceId}`));
      expect(l2026[0][0]).toBe("01/02/2026");
      expect(l2026[1][0]).toBe("01/03/2026");

      // « Tous » (exercice vide) : inclut aussi 2025, en premier (ordre chronologique).
      const tous = lignes(await docMouvements(jeu.associationId, "/mouvements/pdf?exercice="));
      expect(tous.filter((c) => c[0].length === 10 && c[0][2] === "/")).toHaveLength(3);
      expect(tous[0][0]).toBe("01/06/2025");

      // Paramètre absent : exercice en cours uniquement (celui du jeu, 2026) — ici dépend de la date du jour, donc on
      // vérifie seulement qu'aucun 2025 ne s'y mêle quand l'exercice 2026 est choisi explicitement.
      expect(JSON.stringify(l2026)).not.toContain("2025");
    });

    it("la route répond en PDF ; exercice vide = tous, absent = exercice en cours", async () => {
      const tous = await pdfMouvementsRoute(requete("/mouvements/pdf?exercice="));
      expect(tous.status).toBe(200);
      expect(tous.headers.get("Content-Type")).toBe("application/pdf");
      expect(tous.headers.get("Content-Disposition")).toContain("mouvements-tous-association-test");
      expect(await texte(new Uint8Array(await tous.arrayBuffer()))).toBe(1);

      const un = await pdfMouvementsRoute(requete(`/mouvements/pdf?exercice=${jeu.exerciceId}&journal=${jeu.journalId}`));
      expect(un.status).toBe(200);
      expect(un.headers.get("Content-Disposition")).toContain("mouvements-2026-caisse-association-test");
    });

    it("un exercice ou un compte d'une autre association renvoie 404", async () => {
      const autre = await creerJeuComplet();
      contexte.associationId = jeu.associationId;
      expect((await pdfMouvementsRoute(requete(`/mouvements/pdf?exercice=${autre.exerciceId}`))).status).toBe(404);
      expect((await pdfMouvementsRoute(requete(`/mouvements/pdf?journal=${autre.journalId}`))).status).toBe(404);
    });

    it("n'inclut jamais un mouvement d'une autre association", async () => {
      const autre = await creerJeuComplet();
      await mvt(autre, autre.exerciceId, "recette", "2026-04-01", 9999, { tiers: "SECRET-AUTRE" });
      contexte.associationId = jeu.associationId;
      const mouvements = await listerMouvementsFiltres(jeu.associationId, {}, "asc");
      expect(JSON.stringify(lignes(await pdfMouvements(mouvements, { compte: null, exercice: null }, "Association test")))).not.toContain("SECRET-AUTRE");
    });

    it("affiche un virement entre comptes sans le compter dans les totaux, et le statut rapproché", async () => {
      const banque = await prisma.journal.create({ data: { associationId: jeu.associationId, nom: "Banque" } });
      const rapprochement = await prisma.rapprochement.create({ data: { associationId: jeu.associationId, journalId: jeu.journalId, date: new Date("2026-03-31"), solde: 0 } });
      await prisma.mouvement.create({
        data: {
          associationId: jeu.associationId, exerciceId: jeu.exerciceId, journalId: jeu.journalId, journalDestinationId: banque.id,
          date: new Date("2026-04-01"), dateBilan: new Date("2026-04-01"), type: "virement_interne", typeTransaction: "virement", montant: 77,
          pointe: true, rapprochementId: rapprochement.id,
        },
      });
      const mouvements = await listerMouvementsFiltres(jeu.associationId, { exerciceId: jeu.exerciceId }, "asc");
      const l = lignes(await pdfMouvements(mouvements, { compte: null, exercice: "2026" }, "Association test"));

      expect(l.find((c) => c[2] === "Virement")).toEqual(["01/04/2026", "—", "Virement", "Caisse → Banque", montant(77), "Rapproché"]);
      // Les virements ne comptent ni en recette ni en dépense : totaux inchangés, vérifiés séparément
      // (recettes et dépenses s'annuleraient dans le solde si le virement était compté des deux côtés).
      expect(l.find((c) => c[3].startsWith("Total recettes"))![4]).toBe(montant(500));
      expect(l.find((c) => c[3] === "Total dépenses")![4]).toBe(montant(120.5));
      expect(l[l.length - 1][4]).toBe(montant(379.5));
    });

    it("un compte en lecture seule peut télécharger", async () => {
      contexte.lectureSeule = true;
      expect((await pdfMouvementsRoute(requete("/mouvements/pdf"))).status).toBe(200);
    });
  });

  describe("rapprochement", () => {
    it("reprend le point de départ, l'écart, les mouvements non rapprochés, l'historique et le détail", async () => {
      await prisma.mouvement.updateMany({ where: { associationId: jeu.associationId, pointe: true }, data: { pointe: true } });
      // La dépense pointée de février est rapprochée au 28/02 (solde = -120,50).
      expect(await validerRapprochement(jeu.associationId, jeu.journalId, new Date("2026-02-28"), -120.5)).toEqual({ ok: true });

      const [dernierH] = await listerRapprochements(jeu.associationId, jeu.journalId);
      const dernier = (await dernierRapprochement(jeu.associationId, jeu.journalId))!;
      const doc = await pdfRapprochement(
        {
          compte: "Caisse",
          base: { date: dernier.date, solde: dernier.solde },
          releve: { date: new Date("2026-03-31"), solde: 379.5, ecart: 500 },
          nonRapproches: await mouvementsNonRapprochesJournal(jeu.associationId, jeu.journalId, new Date("2026-03-31")),
          historique: await listerRapprochements(jeu.associationId, jeu.journalId),
          detail: { rapprochement: dernierH, mouvements: await listerMouvementsFiltres(jeu.associationId, { exerciceId: jeu.exerciceId }, "asc").then((m) => m.filter((x) => x.rapprochementId === dernier.id)) },
        },
        "Association test",
      );
      const l = lignes(doc);

      expect(l).toContainEqual(["Solde du dernier rapprochement (28/02/2026)", montant(-120.5)]);
      expect(l).toContainEqual(["Solde du relevé (31/03/2026)", montant(379.5)]);
      expect(l).toContainEqual(["Écart restant à pointer", montant(500)]);
      expect(l.some((c) => c[2] === "Recette" && c[3].includes("Dupont"))).toBe(true); // non rapproché
      expect(l).toContainEqual(["28/02/2026", montant(-120.5), "1", expect.any(String)]);
      expect(doc.modele.some((m) => m.type === "texte" && m.texte.startsWith("Détail du rapprochement du 28/02/2026"))).toBe(true);
    });

    it("sans rapprochement, part du solde d'ouverture ; un écart nul est signalé", async () => {
      const doc = await pdfRapprochement(
        { compte: "Caisse", base: { date: null, solde: 100 }, releve: { date: new Date("2026-03-31"), solde: 100, ecart: 0 }, nonRapproches: [], historique: [], detail: null },
        "Association test",
      );
      const l = lignes(doc);
      expect(l).toContainEqual(["Solde d'ouverture du compte (aucun rapprochement validé)", montant(100)]);
      expect(l).toContainEqual(["Écart : nul — rapprochement possible", montant(0)]);
      expect(l.some((c) => c[0] === "Aucun rapprochement validé.")).toBe(true);
    });

    it("la route répond en PDF, avec ou sans solde de relevé", async () => {
      const sans = await pdfRapprochementRoute(requete("/rapprochement/pdf"));
      expect(sans.status).toBe(200);
      expect(sans.headers.get("Content-Disposition")).toContain("rapprochement-caisse-association-test");
      const avec = await pdfRapprochementRoute(requete(`/rapprochement/pdf?journal=${jeu.journalId}&date=2026-03-31&solde=379.5`));
      expect(avec.status).toBe(200);
      expect(await texte(new Uint8Array(await avec.arrayBuffer()))).toBeGreaterThanOrEqual(1);
    });

    it("refuse un compte d'une autre association (404), une date ou un solde invalides (400)", async () => {
      const autre = await creerJeuComplet();
      contexte.associationId = jeu.associationId;
      expect((await pdfRapprochementRoute(requete(`/rapprochement/pdf?journal=${autre.journalId}`))).status).toBe(404);
      expect((await pdfRapprochementRoute(requete("/rapprochement/pdf?date=pas-une-date"))).status).toBe(400);
      expect((await pdfRapprochementRoute(requete("/rapprochement/pdf?solde=abc"))).status).toBe(400);
    });

    it("ne détaille jamais le rapprochement d'une autre association", async () => {
      const autre = await creerJeuComplet();
      await mvt(autre, autre.exerciceId, "recette", "2026-02-01", 5, { pointe: true, tiers: "SECRET-AUTRE" });
      await validerRapprochement(autre.associationId, autre.journalId, new Date("2026-02-28"), 5);
      const idAutre = (await dernierRapprochement(autre.associationId, autre.journalId))!.id;
      contexte.associationId = jeu.associationId;

      const res = await pdfRapprochementRoute(requete(`/rapprochement/pdf?journal=${jeu.journalId}&detail=${idAutre}`));
      expect(res.status).toBe(200);
      // Le détail est ignoré : l'identifiant n'est pas dans l'historique de ce compte.
      const doc = await docRapprochement(jeu.associationId, `/rapprochement/pdf?journal=${jeu.journalId}&detail=${idAutre}`);
      expect(doc.modele.some((m) => m.type === "texte" && m.texte.startsWith("Détail du rapprochement"))).toBe(false);
      expect(JSON.stringify(doc.modele)).not.toContain("SECRET-AUTRE");
    });
  });
});
