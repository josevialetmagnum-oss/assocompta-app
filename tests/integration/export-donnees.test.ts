import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/association", async () => (await import("../support/contexte")).moduleAssociationDeTest());

import { prisma } from "@/lib/prisma";
import { celluleCsv, exporterAssociation, exporterMouvementsCsv, montantCsv } from "@/lib/export-donnees";
import { nomFichier } from "@/lib/nom-fichier";
import { GET as routeComplet } from "@/app/parametrage/export/complet/route";
import { GET as routeMouvements } from "@/app/parametrage/export/mouvements/route";
import { creerJeuComplet, type Jeu } from "../support/jeu-de-donnees";
import { verifierBaseDeTest, viderBase } from "../support/base-test";
import { contexte } from "../support/contexte";

const SECRET_HASH = "$2a$12$HASH-SECRET-A-NE-JAMAIS-EXPORTER";

async function peupler(jeu: Jeu, suffixe = "") {
  const banque = await prisma.journal.create({ data: { associationId: jeu.associationId, nom: `Banque${suffixe}`, soldeInitial: 100 } });
  const rapprochement = await prisma.rapprochement.create({
    data: { associationId: jeu.associationId, journalId: jeu.journalId, date: new Date("2026-02-28"), solde: 1234.5 },
  });
  const cotisation = await prisma.mouvement.create({
    data: {
      associationId: jeu.associationId, exerciceId: jeu.exerciceId, journalId: jeu.journalId, rapprochementId: rapprochement.id,
      date: new Date("2026-02-01"), dateBilan: new Date("2026-02-01"), type: "recette", typeTransaction: "cheque", montant: 1234.5,
      tiers: `Dupont${suffixe}`, numeroCheque: "0001234", numeroFacture: "F-12", commentaire: "Cotisation; \"annuelle\"", pointe: true,
      ventilations: { create: [{ sousCategorieId: jeu.sousCategorieRecette, montant: 1000 }, { sousCategorieId: jeu.sousCategorieRecette, montant: 234.5 }] },
    },
  });
  await prisma.mouvement.create({
    data: {
      associationId: jeu.associationId, exerciceId: jeu.exerciceId, journalId: jeu.journalId, journalDestinationId: banque.id,
      date: new Date("2026-03-01"), dateBilan: new Date("2026-03-01"), type: "virement_interne", typeTransaction: "virement", montant: 200,
    },
  });
  await prisma.soldeCloture.create({ data: { exerciceId: jeu.exerciceId, journalId: jeu.journalId, solde: 321 } });
  await prisma.utilisateur.create({
    data: { email: `tresorier${suffixe}@test.local`, motDePasseHash: SECRET_HASH, role: "tresorier", associationId: jeu.associationId },
  });
  return { cotisation, banque, rapprochement };
}

describe("export des données d'une association", () => {
  let jeu: Jeu;

  beforeEach(async () => {
    verifierBaseDeTest();
    await viderBase();
    jeu = await creerJeuComplet();
    contexte.associationId = jeu.associationId;
    contexte.lectureSeule = false;
  });

  describe("sauvegarde complète (JSON)", () => {
    it("contient l'association, ses comptes, journaux, catégories, exercices, rapprochements et mouvements ventilés", async () => {
      const { cotisation, rapprochement } = await peupler(jeu);
      const e = await exporterAssociation(jeu.associationId);

      expect(e).toMatchObject({ format: "assocompta-export", version: 1, association: { nom: "Association test", active: true } });
      expect(e.comptes).toEqual([expect.objectContaining({ email: "tresorier@test.local", role: "tresorier", actif: true })]);
      expect(e.journaux.map((j) => [j.nom, j.soldeInitial])).toEqual([["Banque", 100], ["Caisse", 0]]);
      expect(e.categories.map((c) => [c.nom, c.type, c.sousCategories.map((s) => s.nom)])).toEqual([
        ["Cotisations", "recette", ["Cotisations annuelles"]],
        ["Fournitures", "depense", ["Papeterie"]],
      ]);
      expect(e.exercices).toEqual([expect.objectContaining({ libelle: "2026", dateDebut: "2026-01-01", dateFin: "2026-12-31", soldesCloture: [{ compte: "Caisse", solde: 321 }] })]);
      expect(e.rapprochements).toEqual([expect.objectContaining({ id: rapprochement.id, compte: "Caisse", date: "2026-02-28", solde: 1234.5, mouvements: [cotisation.id] })]);

      expect(e.mouvements).toHaveLength(2);
      expect(e.mouvements[0]).toMatchObject({
        id: cotisation.id, exercice: "2026", date: "2026-02-01", type: "recette", montant: 1234.5, compte: "Caisse", compteDestination: null,
        typeTransaction: "cheque", tiers: "Dupont", numeroCheque: "0001234", pointe: true, rapprochementId: rapprochement.id,
        ventilations: [
          { categorie: "Cotisations", sousCategorie: "Cotisations annuelles", montant: 1000 },
          { categorie: "Cotisations", sousCategorie: "Cotisations annuelles", montant: 234.5 },
        ],
      });
      expect(e.mouvements[1]).toMatchObject({ type: "virement_interne", compte: "Caisse", compteDestination: "Banque", ventilations: [] });
    });

    it("n'exporte jamais de mot de passe, de hash ni de jeton", async () => {
      await peupler(jeu);
      const utilisateur = await prisma.utilisateur.findFirstOrThrow({ where: { associationId: jeu.associationId } });
      await prisma.reinitialisationMotDePasse.create({ data: { utilisateurId: utilisateur.id, jetonHash: "JETON-SECRET", expireLe: new Date("2030-01-01") } });

      const texte = JSON.stringify(await exporterAssociation(jeu.associationId)) + (await exporterMouvementsCsv(jeu.associationId));
      expect(texte).not.toContain("HASH-SECRET");
      expect(texte).not.toContain("JETON-SECRET");
      expect(texte.toLowerCase()).not.toContain("motdepasse");
    });

    it("ne contient rien d'une autre association", async () => {
      await peupler(jeu);
      const autre = await creerJeuComplet();
      await peupler(autre, "-AUTRE");
      contexte.associationId = jeu.associationId;

      const texte = JSON.stringify(await exporterAssociation(jeu.associationId)) + (await exporterMouvementsCsv(jeu.associationId));
      expect(texte).not.toContain("AUTRE");
      expect((await exporterAssociation(jeu.associationId)).mouvements).toHaveLength(2);
    });
  });

  describe("mouvements (CSV)", () => {
    it("une ligne par ventilation, au format Excel français (BOM, « ; », CRLF, virgule décimale)", async () => {
      await peupler(jeu);
      const csv = await exporterMouvementsCsv(jeu.associationId);

      expect(csv.startsWith("﻿")).toBe(true);
      const lignes = csv.slice(1).split("\r\n");
      expect(lignes[lignes.length - 1]).toBe("");
      expect(lignes[0]).toBe(
        "N° mouvement;Date;Date bilan;Exercice;Type;Compte;Compte destination;Catégorie;Sous-catégorie;Montant;Tiers;Type de transaction;N° chèque;N° facture;Commentaire;Pointé;Rapprochement du",
      );
      expect(lignes).toHaveLength(1 + 3 + 1); // en-tête + 2 ventilations + 1 virement + ligne vide finale

      expect(lignes[1]).toContain(";2026-02-01;2026-02-01;2026;Recette;Caisse;;Cotisations;Cotisations annuelles;1000,00;Dupont;Chèque;0001234;F-12;");
      expect(lignes[2]).toContain(";Cotisations annuelles;234,50;");
      expect(lignes[1].endsWith(";Oui;2026-02-28")).toBe(true);
      expect(lignes[3]).toContain(";2026-03-01;2026-03-01;2026;Virement interne;Caisse;Banque;;;200,00;");
      expect(lignes[3].endsWith(";Non;")).toBe(true);
    });

    it("protège les cellules à guillemets et à « ; »", async () => {
      await peupler(jeu);
      const csv = await exporterMouvementsCsv(jeu.associationId);
      expect(csv).toContain('"Cotisation; ""annuelle"""');
    });

    it("neutralise une formule saisie dans un champ libre (injection Excel)", async () => {
      await prisma.mouvement.create({
        data: {
          associationId: jeu.associationId, exerciceId: jeu.exerciceId, journalId: jeu.journalId,
          date: new Date("2026-04-01"), dateBilan: new Date("2026-04-01"), type: "recette", typeTransaction: "autre", montant: 5,
          tiers: "=HYPERLINK(\"http://pirate.example\")", commentaire: "+cmd|' /C calc'!A0",
          ventilations: { create: [{ sousCategorieId: jeu.sousCategorieRecette, montant: 5 }] },
        },
      });
      const csv = await exporterMouvementsCsv(jeu.associationId);
      expect(csv).not.toMatch(/;=HYPERLINK/);
      expect(csv).not.toMatch(/;\+cmd/);
      expect(csv).toContain("'=HYPERLINK");
    });

    it("un export sans mouvement ne contient que l'en-tête", async () => {
      const csv = await exporterMouvementsCsv(jeu.associationId);
      expect(csv.slice(1).split("\r\n")).toHaveLength(2);
    });
  });

  describe("routes", () => {
    it("téléchargent le CSV et le JSON avec le bon type et un nom de fichier sûr", async () => {
      await peupler(jeu);
      const csv = await routeMouvements();
      expect(csv.status).toBe(200);
      expect(csv.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
      expect(csv.headers.get("Content-Disposition")).toMatch(/^attachment; filename="mouvements-association-test-\d{4}-\d{2}-\d{2}\.csv"$/);
      expect(csv.headers.get("Cache-Control")).toContain("no-store");

      const json = await routeComplet();
      expect(json.status).toBe(200);
      expect(json.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
      expect(json.headers.get("Content-Disposition")).toMatch(/^attachment; filename="sauvegarde-association-test-\d{4}-\d{2}-\d{2}\.json"$/);
      expect(JSON.parse(await json.text()).association.nom).toBe("Association test");
    });

    it("restent disponibles pour un compte en lecture seule (consultation)", async () => {
      contexte.lectureSeule = true;
      expect((await routeMouvements()).status).toBe(200);
      expect((await routeComplet()).status).toBe(200);
    });
  });
});

describe("outils d'export", () => {
  it("celluleCsv", () => {
    expect(celluleCsv(null)).toBe("");
    expect(celluleCsv("simple")).toBe("simple");
    expect(celluleCsv("a;b")).toBe('"a;b"');
    expect(celluleCsv('dit "oui"')).toBe('"dit ""oui"""');
    expect(celluleCsv("ligne1\nligne2")).toBe('"ligne1\nligne2"');
    for (const piege of ["=1+1", "+1", "-1", "@SUM(A1)", "\tx"]) expect(celluleCsv(piege).startsWith("'")).toBe(true);
    expect(celluleCsv("Aujourd'hui")).toBe("Aujourd'hui");
  });

  it("montantCsv", () => {
    expect(montantCsv(1234.5)).toBe("1234,50");
    expect(montantCsv(0)).toBe("0,00");
    expect(montantCsv(-12.5)).toBe("-12,50");
    expect(montantCsv(1000000)).toBe("1000000,00");
  });

  it("nomFichier", () => {
    expect(nomFichier("csv", "export", "mouvements", "Club de Judo — Saint-Étienne", "2026-10-02")).toBe("mouvements-club-de-judo-saint-etienne-2026-10-02.csv");
    expect(nomFichier("json", "export", "../../etc/passwd")).toBe("etc-passwd.json");
    expect(nomFichier("csv", "export", "???")).toBe("export.csv");
  });
});
