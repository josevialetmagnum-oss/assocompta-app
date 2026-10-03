import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/association", async () => (await import("../support/contexte")).moduleAssociationDeTest());
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { prisma } from "@/lib/prisma";
import { exporterAssociation } from "@/lib/export-donnees";
import { associationEstVide, importerSauvegarde, TAILLE_MAX_SAUVEGARDE, validerSauvegarde } from "@/lib/import-sauvegarde";
import { POST as routeImport } from "@/app/parametrage/import/route";
import { creerJeuComplet } from "../support/jeu-de-donnees";
import { verifierBaseDeTest, viderBase } from "../support/base-test";
import { contexte } from "../support/contexte";

type Export = Awaited<ReturnType<typeof exporterAssociation>>;

// Association source bien remplie : de quoi exercer chaque partie de l'import.
async function creerSource(): Promise<number> {
  const jeu = await creerJeuComplet();
  const a = jeu.associationId;
  await prisma.journal.update({ where: { id: jeu.journalId }, data: { soldeInitial: 250.5 } });
  const banque = await prisma.journal.create({ data: { associationId: a, nom: "Banque", actif: false, soldeInitial: 1000 } });
  // Même nom en recette et en dépense : la ventilation doit retrouver la bonne catégorie selon le type.
  const dons = await prisma.categorie.create({ data: { associationId: a, nom: "Dons", type: "recette" } });
  const donsDep = await prisma.categorie.create({ data: { associationId: a, nom: "Dons", type: "depense", actif: false } });
  const scDonsRec = await prisma.sousCategorie.create({ data: { categorieId: dons.id, nom: "Manuels" } });
  const scDonsDep = await prisma.sousCategorie.create({ data: { categorieId: donsDep.id, nom: "Manuels", actif: false } });
  const ex2025 = await prisma.exercice.create({
    data: { associationId: a, libelle: "2025", dateDebut: new Date("2025-01-01"), dateFin: new Date("2025-12-31"), cloture: true, clotureLe: new Date("2026-01-05T10:00:00Z") },
  });
  await prisma.soldeCloture.createMany({ data: [{ exerciceId: ex2025.id, journalId: jeu.journalId, solde: 400 }, { exerciceId: ex2025.id, journalId: banque.id, solde: 1000 }] });

  const rapprochement = await prisma.rapprochement.create({
    data: { associationId: a, journalId: jeu.journalId, date: new Date("2025-12-31"), solde: 400, createdAt: new Date("2026-01-03T09:30:00Z") },
  });
  const base = (exerciceId: number, date: string) => ({ associationId: a, exerciceId, journalId: jeu.journalId, date: new Date(date), dateBilan: new Date(date), typeTransaction: "cheque" as const });
  await prisma.mouvement.create({
    data: { ...base(ex2025.id, "2025-06-01"), type: "recette", montant: 149.5, pointe: true, pointeLe: new Date("2025-12-31T08:00:00Z"), rapprochementId: rapprochement.id,
      tiers: "Dupont", numeroCheque: "123", numeroFacture: "F1", commentaire: "Cotisation; \"annuelle\"\nligne 2",
      ventilations: { create: [{ sousCategorieId: jeu.sousCategorieRecette, montant: 100 }, { sousCategorieId: scDonsRec.id, montant: 49.5 }] } },
  });
  await prisma.mouvement.create({
    data: { ...base(jeu.exerciceId, "2026-02-01"), type: "depense", montant: 30, ventilations: { create: [{ sousCategorieId: jeu.sousCategorieDepense, montant: 30 }] } },
  });
  await prisma.mouvement.create({
    data: { ...base(jeu.exerciceId, "2026-02-01"), type: "depense", montant: 12, pointe: true, pointeLe: new Date("2026-02-02T08:00:00Z"), ventilations: { create: [{ sousCategorieId: scDonsDep.id, montant: 12 }] } },
  });
  await prisma.mouvement.create({
    data: { ...base(jeu.exerciceId, "2026-03-01"), type: "virement_interne", typeTransaction: "virement", montant: 200, journalDestinationId: banque.id },
  });
  await prisma.utilisateur.create({ data: { email: `source-${a}@test.local`, motDePasseHash: "x", role: "tresorier", associationId: a } });
  return a;
}

// Rend deux exports comparables : sans ce qui est propre à l'association (nom, dates de création,
// comptes, horodatage) et avec les identifiants remplacés par leur rang.
function normaliser(e: Export) {
  const rangMouvement = new Map(e.mouvements.map((m, i) => [m.id, i]));
  const rangRapprochement = new Map(e.rapprochements.map((r, i) => [r.id, i]));
  return {
    journaux: e.journaux, categories: e.categories, exercices: e.exercices,
    rapprochements: e.rapprochements.map((r) => ({ ...r, id: rangRapprochement.get(r.id), mouvements: r.mouvements.map((m) => rangMouvement.get(m)) })),
    mouvements: e.mouvements.map((m) => ({ ...m, id: rangMouvement.get(m.id), rapprochementId: m.rapprochementId === null ? null : rangRapprochement.get(m.rapprochementId) })),
  };
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

describe("import d'une sauvegarde", () => {
  let source: number;
  let cible: number;
  let sauvegarde: Export;
  let texte: string;

  beforeEach(async () => {
    verifierBaseDeTest();
    await viderBase();
    source = await creerSource();
    cible = (await prisma.association.create({ data: { nom: "Association cible" } })).id;
    contexte.associationId = cible;
    contexte.lectureSeule = false;
    sauvegarde = await exporterAssociation(source);
    texte = JSON.stringify(sauvegarde);
  });

  describe("aller-retour", () => {
    it("export → import → export redonne exactement les mêmes données", async () => {
      const res = await importerSauvegarde(cible, texte, true);
      expect(res).toMatchObject({ ok: true, resume: { journaux: 2, mouvements: 4, exercices: 2, rapprochements: 1 } });

      const apres = await exporterAssociation(cible);
      expect(normaliser(apres)).toEqual(normaliser(sauvegarde));
      // Détails qui comptent : ventilations, nature du virement, rapprochement, soldes figés, états actif/inactif.
      expect(apres.mouvements.find((m) => m.tiers === "Dupont")).toMatchObject({ montant: 149.5, pointe: true, commentaire: "Cotisation; \"annuelle\"\nligne 2" });
      expect(apres.exercices.find((x) => x.libelle === "2025")?.soldesCloture).toHaveLength(2);
      // L'export est déterministe (ordre par nom de compte), sinon deux exports du même contenu pourraient différer.
      expect(sauvegarde.exercices.find((x) => x.libelle === "2025")?.soldesCloture.map((s) => s.compte)).toEqual(["Banque", "Caisse"]);
      expect(apres.categories.filter((c) => c.nom === "Dons").map((c) => c.type).sort()).toEqual(["depense", "recette"]);
    });

    it("l'association importée reste utilisable : soldes et résultats corrects", async () => {
      await importerSauvegarde(cible, texte, true);
      const { soldesJournaux } = await import("@/lib/tresorerie");
      const avant = await soldesJournaux(source);
      const apres = await soldesJournaux(cible);
      expect(apres.map((s) => [s.nom, s.solde])).toEqual(avant.map((s) => [s.nom, s.solde]));
    });

    it("n'importe ni le nom de l'association ni ses comptes, et ne touche pas à la source", async () => {
      const avant = await exporterAssociation(source);
      await importerSauvegarde(cible, texte, true);
      expect((await prisma.association.findUniqueOrThrow({ where: { id: cible } })).nom).toBe("Association cible");
      expect(await prisma.utilisateur.count({ where: { associationId: cible } })).toBe(0);
      expect(normaliser(await exporterAssociation(source))).toEqual(normaliser(avant));
    });

    it("accepte un fichier précédé d'une marque d'ordre des octets (BOM)", async () => {
      expect((await importerSauvegarde(cible, `﻿${texte}`, true)).ok).toBe(true);
    });
  });

  describe("aperçu et garde-fous", () => {
    it("la vérification seule n'écrit rien mais renvoie le résumé", async () => {
      const res = await importerSauvegarde(cible, texte, false);
      expect(res).toMatchObject({ ok: true, resume: { mouvements: 4, premiereDate: "2025-06-01", derniereDate: "2026-03-01" } });
      expect(await associationEstVide(cible)).toBe(true);
    });

    it("refuse une association qui contient déjà des données, sans rien modifier", async () => {
      await prisma.journal.create({ data: { associationId: cible, nom: "Caisse existante" } });
      const res = await importerSauvegarde(cible, texte, true);
      expect(res.ok).toBe(false);
      expect(!res.ok && res.erreurs[0]).toContain("déjà des données");
      expect(await prisma.journal.count({ where: { associationId: cible } })).toBe(1);
      expect(await prisma.mouvement.count({ where: { associationId: cible } })).toBe(0);
    });

    it("un second import dans la même association est refusé", async () => {
      expect((await importerSauvegarde(cible, texte, true)).ok).toBe(true);
      const seconde = await importerSauvegarde(cible, texte, true);
      expect(seconde.ok).toBe(false);
      expect(await prisma.mouvement.count({ where: { associationId: cible } })).toBe(4);
    });

    it("tout ou rien : un échec en cours d'écriture ne laisse aucune donnée", async () => {
      // Un caractère NUL passe la validation JSON mais est refusé par PostgreSQL à l'insertion des mouvements,
      // donc après la création des comptes, catégories, exercices et rapprochements.
      const piege = clone(sauvegarde);
      piege.mouvements[1].tiers = "a\u0000b";
      await expect(importerSauvegarde(cible, JSON.stringify(piege), true)).rejects.toThrow();
      expect(await associationEstVide(cible)).toBe(true);
      expect(await prisma.soldeCloture.count()).toBe(2); // ceux de la source seulement
    });

    it("ne touche jamais une autre association", async () => {
      const autre = await creerSource();
      contexte.associationId = cible;
      const avant = await exporterAssociation(autre);
      await importerSauvegarde(cible, texte, true);
      expect(normaliser(await exporterAssociation(autre))).toEqual(normaliser(avant));
    });
  });

  describe("validation : rien n'est écrit, toutes les erreurs sont signalées", () => {
    const cas: [string, (e: Export) => void, string][] = [
      ["compte en double", (e) => e.journaux.push({ ...e.journaux[0] }), "en double"],
      ["exercice dont la fin précède le début", (e) => { e.exercices[0].dateFin = "2000-01-01"; }, "date de fin"],
      ["exercice en double", (e) => e.exercices.push({ ...e.exercices[0] }), "en double"],
      ["catégorie en double", (e) => e.categories.push({ ...e.categories[0] }), "en double"],
      ["sous-catégorie en double", (e) => e.categories[0].sousCategories.push({ ...e.categories[0].sousCategories[0] }), "en double"],
      ["date impossible", (e) => { e.mouvements[0].date = "2026-02-30"; }, "AAAA-MM-JJ"],
      ["montant négatif", (e) => { e.mouvements[0].montant = -5; }, "positif"],
      ["montant non numérique", (e) => { (e.mouvements[0] as unknown as { montant: string }).montant = "12"; }, "nombre attendu"],
      ["type de mouvement inconnu", (e) => { (e.mouvements[0] as unknown as { type: string }).type = "don"; }, "attendu"],
      ["type de transaction inconnu", (e) => { (e.mouvements[0] as unknown as { typeTransaction: string }).typeTransaction = "bitcoin"; }, "typeTransaction"],
      ["compte inconnu", (e) => { e.mouvements[0].compte = "Inconnu"; }, "n'existe pas"],
      ["exercice inconnu", (e) => { e.mouvements[0].exercice = "1999"; }, "n'existe pas"],
      ["ventilation qui ne totalise pas le montant", (e) => { e.mouvements[0].ventilations[0].montant = 1; }, "ne correspond pas"],
      ["sous-catégorie inconnue", (e) => { e.mouvements[0].ventilations[0].sousCategorie = "Fantôme"; }, "n'existe pas"],
      ["recette ventilée sur une catégorie de dépense", (e) => { e.mouvements[0].ventilations = [{ categorie: "Fournitures", sousCategorie: "Papeterie", montant: 149.5 }]; }, "n'existe pas"],
      ["recette sans ventilation", (e) => { e.mouvements[0].ventilations = []; }, "ventilation"],
      ["recette avec compte de destination", (e) => { e.mouvements[0].compteDestination = "Banque"; }, "destination"],
      ["virement vers le même compte", (e) => { const v = e.mouvements.find((m) => m.type === "virement_interne")!; v.compteDestination = v.compte; }, "lui-même"],
      ["virement ventilé", (e) => { e.mouvements.find((m) => m.type === "virement_interne")!.ventilations = [{ categorie: "Cotisations", sousCategorie: "Cotisations annuelles", montant: 200 }]; }, "pas de ventilation"],
      ["virement sans destination", (e) => { e.mouvements.find((m) => m.type === "virement_interne")!.compteDestination = null; }, "destination"],
      ["identifiant de mouvement en double", (e) => { e.mouvements[1].id = e.mouvements[0].id; }, "en double"],
      ["mouvement rapproché vers un rapprochement inconnu", (e) => { e.mouvements[0].rapprochementId = 9999; }, "n'existe pas"],
      ["mouvement rapproché mais non pointé", (e) => { e.mouvements[0].pointe = false; }, "pointé"],
      ["rapprochement qui liste un mouvement absent", (e) => e.rapprochements[0].mouvements.push(424242), "absent"],
      ["rapprochement qui liste un mouvement non rattaché", (e) => e.rapprochements[0].mouvements.push(e.mouvements[1].id), "pas rattaché"],
      ["rapprochement d'un autre compte", (e) => { e.rapprochements[0].compte = "Banque"; }, "autre compte"],
      ["soldes de clôture d'un exercice ouvert", (e) => { e.exercices.find((x) => !x.cloture)!.soldesCloture.push({ compte: "Caisse", solde: 1 }); }, "non clôturé"],
      ["texte trop long", (e) => { e.mouvements[0].commentaire = "x".repeat(2001); }, "trop long"],
      ["liste manquante", (e) => { delete (e as Partial<Export>).mouvements; }, "liste attendue"],
    ];

    it.each(cas)("refuse : %s", async (_nom, modifier, extrait) => {
      const faux = clone(sauvegarde);
      modifier(faux);
      const res = await importerSauvegarde(cible, JSON.stringify(faux), true);
      expect(res.ok).toBe(false);
      expect(!res.ok && res.erreurs.join(" | ")).toContain(extrait);
      expect(await associationEstVide(cible)).toBe(true);
    });

    it("refuse un autre format, une autre version, un JSON invalide et un fichier trop gros", async () => {
      expect(validerSauvegarde({ ...sauvegarde, format: "autre" }).ok).toBe(false);
      expect(validerSauvegarde({ ...sauvegarde, version: 2 })).toMatchObject({ ok: false, erreurs: [expect.stringContaining("Version")] });
      expect(validerSauvegarde([1, 2])).toMatchObject({ ok: false });
      expect(validerSauvegarde(null)).toMatchObject({ ok: false });
      expect(await importerSauvegarde(cible, "{pas du json", true)).toMatchObject({ ok: false, erreurs: ["Le fichier n'est pas un JSON valide."] });
      expect(await importerSauvegarde(cible, "x".repeat(TAILLE_MAX_SAUVEGARDE + 1), true)).toMatchObject({ ok: false, erreurs: [expect.stringContaining("volumineux")] });
    });

    it("n'ajoute pas d'erreur parasite quand un mouvement rapproché est déjà rejeté", async () => {
      const faux = clone(sauvegarde);
      const rapproche = faux.mouvements.find((m) => m.rapprochementId !== null)!;
      rapproche.compte = "Inconnu";
      const res = validerSauvegarde(faux);
      expect(res.ok).toBe(false);
      // Une seule erreur : le compte inconnu (pas en plus « le rapprochement ne le liste pas… »).
      expect(!res.ok && res.erreurs).toHaveLength(1);
    });

    it("signale plusieurs erreurs à la fois, sans dépasser la limite d'affichage", async () => {
      const faux = clone(sauvegarde);
      for (const m of faux.mouvements) m.compte = "Inconnu";
      const res = validerSauvegarde(faux);
      expect(res.ok).toBe(false);
      expect(!res.ok && res.erreurs.length).toBeGreaterThanOrEqual(4);

      const enorme = clone(sauvegarde);
      enorme.mouvements = Array.from({ length: 60 }, (_, i) => ({ ...enorme.mouvements[1], id: 1000 + i, compte: "Inconnu" }));
      const res2 = validerSauvegarde(enorme);
      expect(!res2.ok && res2.erreurs.length).toBeLessThanOrEqual(26);
      expect(!res2.ok && res2.erreurs[res2.erreurs.length - 1]).toContain("autre(s) erreur(s)");
    });
  });

  describe("route POST /parametrage/import", () => {
    const requete = (fichier: string | null, options: { confirmer?: boolean; origine?: string } = {}) => {
      const form = new FormData();
      if (fichier !== null) form.set("fichier", new File([fichier], "sauvegarde.json", { type: "application/json" }));
      form.set("confirmer", options.confirmer ? "1" : "0");
      return new Request("http://localhost/parametrage/import", { method: "POST", body: form, headers: options.origine ? { origin: options.origine } : {} });
    };

    it("vérifie sans écrire, puis importe sur confirmation", async () => {
      const verif = await routeImport(requete(texte));
      expect(verif.status).toBe(200);
      expect(await verif.json()).toMatchObject({ ok: true, applique: false, resume: { mouvements: 4 } });
      expect(await associationEstVide(cible)).toBe(true);

      const reel = await routeImport(requete(texte, { confirmer: true, origine: "http://localhost" }));
      expect(reel.status).toBe(200);
      expect(await reel.json()).toMatchObject({ ok: true, applique: true });
      expect(await prisma.mouvement.count({ where: { associationId: cible } })).toBe(4);
    });

    it("refuse un compte en lecture seule (403) sans rien écrire", async () => {
      contexte.lectureSeule = true;
      const res = await routeImport(requete(texte, { confirmer: true }));
      expect(res.status).toBe(403);
      expect(await associationEstVide(cible)).toBe(true);
    });

    it("refuse une requête venue d'un autre site (403)", async () => {
      const res = await routeImport(requete(texte, { confirmer: true, origine: "https://pirate.example" }));
      expect(res.status).toBe(403);
      expect(await associationEstVide(cible)).toBe(true);
    });

    it("renvoie 400 sans fichier, 422 pour un fichier invalide ou une association non vide", async () => {
      expect((await routeImport(requete(null))).status).toBe(400);
      const invalide = await routeImport(requete("{}", { confirmer: true }));
      expect(invalide.status).toBe(422);
      expect((await invalide.json()).erreurs.length).toBeGreaterThan(0);

      await prisma.categorie.create({ data: { associationId: cible, nom: "Déjà là", type: "recette" } });
      expect((await routeImport(requete(texte, { confirmer: true }))).status).toBe(422);
    });

    it("renvoie 413 pour un fichier trop volumineux", async () => {
      const res = await routeImport(requete("x".repeat(TAILLE_MAX_SAUVEGARDE + 1)));
      expect(res.status).toBe(413);
    });

    it("renvoie 500 sans rien laisser quand l'écriture échoue", async () => {
      const piege = clone(sauvegarde);
      piege.mouvements[1].tiers = "a\u0000b";
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const res = await routeImport(requete(JSON.stringify(piege), { confirmer: true }));
      spy.mockRestore();
      expect(res.status).toBe(500);
      expect((await res.json()).erreurs[0]).toContain("rien n'a été modifié");
      expect(await associationEstVide(cible)).toBe(true);
    });
  });
});
