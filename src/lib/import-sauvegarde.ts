// Import d'une sauvegarde JSON produite par l'export (src/lib/export-donnees.ts, format « assocompta-export »
// version 1) dans une association VIDE : restauration après une suppression, ou reprise des données.
//
// Garde-fous :
//  - Seule une association qui ne contient encore aucune donnée (journal, catégorie, exercice,
//    mouvement, rapprochement) peut recevoir un import : jamais de fusion ni d'écrasement.
//  - Le fichier est ENTIÈREMENT validé avant la moindre écriture (format, types, limites de taille,
//    références entre objets, règles comptables) ; toutes les erreurs repérées sont renvoyées.
//  - L'application des données se fait en une seule transaction : tout ou rien.
//  - Ne sont jamais importés : le nom de l'association et ses comptes (identifiants et mots de passe
//    ne figurent pas dans la sauvegarde) — l'association garde les siens.

import { prisma } from "@/lib/prisma";

export const TAILLE_MAX_SAUVEGARDE = 4 * 1024 * 1024; // sous la limite de 4,5 Mo du corps d'une requête Vercel
const LIMITES = { journaux: 200, categories: 500, sousCategories: 5000, exercices: 200, rapprochements: 5000, mouvements: 20000, ventilations: 10 };
const TYPES_MOUVEMENT = ["recette", "depense", "virement_interne"] as const;
const TYPES_TRANSACTION = ["virement", "prelevement", "cheque", "especes", "autre"] as const;
type TypeMouvement = (typeof TYPES_MOUVEMENT)[number];
type TypeTransaction = (typeof TYPES_TRANSACTION)[number];

export type SauvegardeValidee = {
  journaux: { nom: string; actif: boolean; soldeInitial: number }[];
  categories: { nom: string; type: "recette" | "depense"; actif: boolean; sousCategories: { nom: string; actif: boolean }[] }[];
  exercices: {
    libelle: string; dateDebut: Date; dateFin: Date; cloture: boolean; clotureLe: Date | null;
    soldesCloture: { compte: string; solde: number }[];
  }[];
  rapprochements: { id: number; compte: string; date: Date; solde: number; valideLe: Date }[];
  mouvements: {
    id: number; exercice: string; date: Date; dateBilan: Date; type: TypeMouvement; montant: number; compte: string;
    compteDestination: string | null; typeTransaction: TypeTransaction; tiers: string | null; numeroCheque: string | null;
    numeroFacture: string | null; commentaire: string | null; pointe: boolean; pointeLe: Date | null; rapprochementId: number | null;
    ventilations: { categorie: string; sousCategorie: string; montant: number }[];
  }[];
};

export type ResumeSauvegarde = {
  journaux: number; categories: number; sousCategories: number; exercices: number; rapprochements: number; mouvements: number;
  premiereDate: string | null; derniereDate: string | null;
};

export type ResultatValidation =
  | { ok: true; donnees: SauvegardeValidee; resume: ResumeSauvegarde }
  | { ok: false; erreurs: string[] };

const MAX_ERREURS = 25;
const arrondi = (n: number) => Math.round(n * 100) / 100;

// ───────────────────────── validation ─────────────────────────

class Erreurs {
  liste: string[] = [];
  total = 0;
  ajouter(message: string) {
    this.total++;
    if (this.liste.length < MAX_ERREURS) this.liste.push(message);
  }
  get messages(): string[] {
    return this.total > this.liste.length ? [...this.liste, `… et ${this.total - this.liste.length} autre(s) erreur(s).`] : this.liste;
  }
}

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function chaine(v: unknown, e: Erreurs, ou: string, options: { max?: number; obligatoire?: boolean } = {}): string | null {
  const max = options.max ?? 500;
  if (v === null || v === undefined) {
    if (options.obligatoire) e.ajouter(`${ou} : valeur manquante.`);
    return null;
  }
  if (typeof v !== "string") {
    e.ajouter(`${ou} : texte attendu.`);
    return null;
  }
  if (options.obligatoire && v.trim() === "") e.ajouter(`${ou} : valeur vide.`);
  if (v.length > max) {
    e.ajouter(`${ou} : texte trop long (${max} caractères au plus).`);
    return null;
  }
  return v;
}

function nombre(v: unknown, e: Erreurs, ou: string): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    e.ajouter(`${ou} : nombre attendu.`);
    return null;
  }
  return v;
}

function booleen(v: unknown, e: Erreurs, ou: string): boolean {
  if (typeof v !== "boolean") {
    e.ajouter(`${ou} : vrai/faux attendu.`);
    return false;
  }
  return v;
}

function jour(v: unknown, e: Erreurs, ou: string): Date | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(new Date(v).getTime()) || new Date(v).toISOString().slice(0, 10) !== v) {
    e.ajouter(`${ou} : date attendue au format AAAA-MM-JJ.`);
    return null;
  }
  return new Date(v);
}

function horodatage(v: unknown, e: Erreurs, ou: string): Date | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string" || Number.isNaN(new Date(v).getTime())) {
    e.ajouter(`${ou} : date et heure attendues (format ISO).`);
    return null;
  }
  return new Date(v);
}

function tableau(v: unknown, e: Erreurs, ou: string, max: number): unknown[] {
  if (!Array.isArray(v)) {
    e.ajouter(`${ou} : liste attendue.`);
    return [];
  }
  if (v.length > max) {
    e.ajouter(`${ou} : trop d'éléments (${v.length}, maximum ${max}).`);
    return [];
  }
  return v;
}

export function validerSauvegarde(brut: unknown): ResultatValidation {
  const e = new Erreurs();
  if (!estObjet(brut)) return { ok: false, erreurs: ["Le fichier n'est pas une sauvegarde AssoCompta (objet JSON attendu)."] };
  if (brut.format !== "assocompta-export") return { ok: false, erreurs: ["Ce fichier n'est pas une sauvegarde AssoCompta (format inconnu)."] };
  if (brut.version !== 1) return { ok: false, erreurs: [`Version de sauvegarde non prise en charge (${String(brut.version)}).`] };

  // Journaux
  const journaux: SauvegardeValidee["journaux"] = [];
  const nomsJournaux = new Set<string>();
  tableau(brut.journaux, e, "journaux", LIMITES.journaux).forEach((j, i) => {
    const ou = `journaux[${i + 1}]`;
    if (!estObjet(j)) return e.ajouter(`${ou} : objet attendu.`);
    const nom = chaine(j.nom, e, `${ou}.nom`, { obligatoire: true });
    const soldeInitial = nombre(j.soldeInitial, e, `${ou}.soldeInitial`);
    const actif = booleen(j.actif, e, `${ou}.actif`);
    if (nom === null || soldeInitial === null) return;
    if (nomsJournaux.has(nom)) return e.ajouter(`${ou} : le compte « ${nom} » est en double.`);
    nomsJournaux.add(nom);
    journaux.push({ nom, actif, soldeInitial });
  });

  // Catégories et sous-catégories
  const categories: SauvegardeValidee["categories"] = [];
  const cleCategories = new Set<string>();
  let nbSousCategories = 0;
  tableau(brut.categories, e, "categories", LIMITES.categories).forEach((c, i) => {
    const ou = `categories[${i + 1}]`;
    if (!estObjet(c)) return e.ajouter(`${ou} : objet attendu.`);
    const nom = chaine(c.nom, e, `${ou}.nom`, { obligatoire: true });
    const actif = booleen(c.actif, e, `${ou}.actif`);
    if (c.type !== "recette" && c.type !== "depense") return e.ajouter(`${ou}.type : « recette » ou « depense » attendu.`);
    const sousCategories: { nom: string; actif: boolean }[] = [];
    const nomsSous = new Set<string>();
    tableau(c.sousCategories, e, `${ou}.sousCategories`, LIMITES.sousCategories).forEach((sc, k) => {
      const ouS = `${ou}.sousCategories[${k + 1}]`;
      if (!estObjet(sc)) return e.ajouter(`${ouS} : objet attendu.`);
      const nomS = chaine(sc.nom, e, `${ouS}.nom`, { obligatoire: true });
      const actifS = booleen(sc.actif, e, `${ouS}.actif`);
      if (nomS === null) return;
      if (nomsSous.has(nomS)) return e.ajouter(`${ouS} : la sous-catégorie « ${nomS} » est en double dans « ${nom} ».`);
      nomsSous.add(nomS);
      sousCategories.push({ nom: nomS, actif: actifS });
    });
    nbSousCategories += sousCategories.length;
    if (nom === null) return;
    const cle = `${c.type}\u0000${nom}`;
    if (cleCategories.has(cle)) return e.ajouter(`${ou} : la catégorie « ${nom} » (${c.type}) est en double.`);
    cleCategories.add(cle);
    categories.push({ nom, type: c.type, actif, sousCategories });
  });
  if (nbSousCategories > LIMITES.sousCategories) e.ajouter(`Trop de sous-catégories (maximum ${LIMITES.sousCategories}).`);

  // Exercices
  const exercices: SauvegardeValidee["exercices"] = [];
  const libellesExercices = new Set<string>();
  tableau(brut.exercices, e, "exercices", LIMITES.exercices).forEach((x, i) => {
    const ou = `exercices[${i + 1}]`;
    if (!estObjet(x)) return e.ajouter(`${ou} : objet attendu.`);
    const libelle = chaine(x.libelle, e, `${ou}.libelle`, { obligatoire: true, max: 100 });
    const dateDebut = jour(x.dateDebut, e, `${ou}.dateDebut`);
    const dateFin = jour(x.dateFin, e, `${ou}.dateFin`);
    const cloture = booleen(x.cloture, e, `${ou}.cloture`);
    const clotureLe = horodatage(x.clotureLe, e, `${ou}.clotureLe`);
    const soldesCloture: { compte: string; solde: number }[] = [];
    tableau(x.soldesCloture, e, `${ou}.soldesCloture`, LIMITES.journaux).forEach((s, k) => {
      const ouS = `${ou}.soldesCloture[${k + 1}]`;
      if (!estObjet(s)) return e.ajouter(`${ouS} : objet attendu.`);
      const compte = chaine(s.compte, e, `${ouS}.compte`, { obligatoire: true });
      const solde = nombre(s.solde, e, `${ouS}.solde`);
      if (compte === null || solde === null) return;
      if (!nomsJournaux.has(compte)) return e.ajouter(`${ouS} : le compte « ${compte} » n'existe pas dans la sauvegarde.`);
      soldesCloture.push({ compte, solde });
    });
    if (libelle === null || dateDebut === null || dateFin === null) return;
    if (dateFin <= dateDebut) return e.ajouter(`${ou} : la date de fin doit être postérieure à la date de début.`);
    if (libellesExercices.has(libelle)) return e.ajouter(`${ou} : l'exercice « ${libelle} » est en double.`);
    if (soldesCloture.length > 0 && !cloture) e.ajouter(`${ou} : des soldes de clôture existent pour un exercice non clôturé.`);
    libellesExercices.add(libelle);
    exercices.push({ libelle, dateDebut, dateFin, cloture, clotureLe, soldesCloture });
  });

  // Rapprochements (leurs mouvements sont recoupés plus bas)
  const rapprochements: SauvegardeValidee["rapprochements"] = [];
  const mouvementsDeRapprochement = new Map<number, Set<number>>();
  const idsRapprochements = new Set<number>();
  tableau(brut.rapprochements, e, "rapprochements", LIMITES.rapprochements).forEach((r, i) => {
    const ou = `rapprochements[${i + 1}]`;
    if (!estObjet(r)) return e.ajouter(`${ou} : objet attendu.`);
    const id = nombre(r.id, e, `${ou}.id`);
    const compte = chaine(r.compte, e, `${ou}.compte`, { obligatoire: true });
    const date = jour(r.date, e, `${ou}.date`);
    const solde = nombre(r.solde, e, `${ou}.solde`);
    const valideLe = horodatage(r.valideLe, e, `${ou}.valideLe`);
    const liste = tableau(r.mouvements, e, `${ou}.mouvements`, LIMITES.mouvements);
    if (id === null || compte === null || date === null || solde === null) return;
    if (idsRapprochements.has(id)) return e.ajouter(`${ou} : identifiant de rapprochement ${id} en double.`);
    if (!nomsJournaux.has(compte)) return e.ajouter(`${ou} : le compte « ${compte} » n'existe pas dans la sauvegarde.`);
    const ids = new Set<number>();
    for (const m of liste) {
      if (typeof m !== "number" || !Number.isInteger(m)) e.ajouter(`${ou}.mouvements : identifiants de mouvement attendus.`);
      else ids.add(m);
    }
    idsRapprochements.add(id);
    mouvementsDeRapprochement.set(id, ids);
    rapprochements.push({ id, compte, date, solde, valideLe: valideLe ?? new Date() });
  });

  // Mouvements
  const mouvements: SauvegardeValidee["mouvements"] = [];
  const idsMouvements = new Set<number>();
  const sousCategoriesParCle = new Set<string>();
  for (const c of categories) for (const sc of c.sousCategories) sousCategoriesParCle.add(`${c.type}\u0000${c.nom}\u0000${sc.nom}`);
  const compteDuRapprochement = new Map(rapprochements.map((r) => [r.id, r.compte]));

  tableau(brut.mouvements, e, "mouvements", LIMITES.mouvements).forEach((m, i) => {
    const ou = `mouvements[${i + 1}]`;
    if (!estObjet(m)) return e.ajouter(`${ou} : objet attendu.`);
    const id = nombre(m.id, e, `${ou}.id`);
    const exercice = chaine(m.exercice, e, `${ou}.exercice`, { obligatoire: true });
    const date = jour(m.date, e, `${ou}.date`);
    const dateBilan = jour(m.dateBilan, e, `${ou}.dateBilan`);
    const montant = nombre(m.montant, e, `${ou}.montant`);
    const compte = chaine(m.compte, e, `${ou}.compte`, { obligatoire: true });
    const compteDestination = chaine(m.compteDestination, e, `${ou}.compteDestination`);
    const tiers = chaine(m.tiers, e, `${ou}.tiers`);
    const numeroCheque = chaine(m.numeroCheque, e, `${ou}.numeroCheque`, { max: 100 });
    const numeroFacture = chaine(m.numeroFacture, e, `${ou}.numeroFacture`, { max: 100 });
    const commentaire = chaine(m.commentaire, e, `${ou}.commentaire`, { max: 2000 });
    const pointe = booleen(m.pointe, e, `${ou}.pointe`);
    const pointeLe = horodatage(m.pointeLe, e, `${ou}.pointeLe`);
    if (!TYPES_MOUVEMENT.includes(m.type as TypeMouvement)) return e.ajouter(`${ou}.type : « recette », « depense » ou « virement_interne » attendu.`);
    if (!TYPES_TRANSACTION.includes(m.typeTransaction as TypeTransaction)) return e.ajouter(`${ou}.typeTransaction : valeur inconnue.`);
    const type = m.type as TypeMouvement;
    const typeTransaction = m.typeTransaction as TypeTransaction;

    let rapprochementId: number | null = null;
    if (m.rapprochementId !== null && m.rapprochementId !== undefined) rapprochementId = nombre(m.rapprochementId, e, `${ou}.rapprochementId`);

    const ventilations: { categorie: string; sousCategorie: string; montant: number }[] = [];
    const brutVentilations = tableau(m.ventilations, e, `${ou}.ventilations`, LIMITES.ventilations);
    if (id === null || exercice === null || date === null || dateBilan === null || montant === null || compte === null) return;

    if (idsMouvements.has(id)) return e.ajouter(`${ou} : identifiant de mouvement ${id} en double.`);
    idsMouvements.add(id);
    if (!(montant > 0)) return e.ajouter(`${ou} : le montant doit être positif.`);
    if (!libellesExercices.has(exercice)) return e.ajouter(`${ou} : l'exercice « ${exercice} » n'existe pas dans la sauvegarde.`);
    if (!nomsJournaux.has(compte)) return e.ajouter(`${ou} : le compte « ${compte} » n'existe pas dans la sauvegarde.`);

    if (type === "virement_interne") {
      if (!compteDestination || !nomsJournaux.has(compteDestination)) return e.ajouter(`${ou} : compte de destination du virement inconnu.`);
      if (compteDestination === compte) return e.ajouter(`${ou} : le virement va d'un compte vers lui-même.`);
      if (brutVentilations.length > 0) return e.ajouter(`${ou} : un virement interne n'a pas de ventilation.`);
    } else {
      if (compteDestination) return e.ajouter(`${ou} : seul un virement interne a un compte de destination.`);
      if (brutVentilations.length === 0) return e.ajouter(`${ou} : au moins une ligne de ventilation est requise.`);
      let somme = 0;
      for (const [k, v] of brutVentilations.entries()) {
        const ouV = `${ou}.ventilations[${k + 1}]`;
        if (!estObjet(v)) return e.ajouter(`${ouV} : objet attendu.`);
        const categorie = chaine(v.categorie, e, `${ouV}.categorie`, { obligatoire: true });
        const sousCategorie = chaine(v.sousCategorie, e, `${ouV}.sousCategorie`, { obligatoire: true });
        const mv = nombre(v.montant, e, `${ouV}.montant`);
        if (categorie === null || sousCategorie === null || mv === null) return;
        if (!(mv > 0)) return e.ajouter(`${ouV} : le montant doit être positif.`);
        if (!sousCategoriesParCle.has(`${type}\u0000${categorie}\u0000${sousCategorie}`)) {
          return e.ajouter(`${ouV} : la sous-catégorie « ${categorie} — ${sousCategorie} » (${type}) n'existe pas dans la sauvegarde.`);
        }
        somme += mv;
        ventilations.push({ categorie, sousCategorie, montant: mv });
      }
      if (Math.abs(arrondi(somme) - arrondi(montant)) > 0.01) {
        return e.ajouter(`${ou} : le total des ventilations (${arrondi(somme)}) ne correspond pas au montant (${arrondi(montant)}).`);
      }
    }

    // Pointage et rapprochement : un mouvement rapproché est forcément pointé, et recoupé dans les deux sens.
    if (rapprochementId !== null) {
      if (!idsRapprochements.has(rapprochementId)) return e.ajouter(`${ou} : le rapprochement ${rapprochementId} n'existe pas dans la sauvegarde.`);
      if (!pointe) e.ajouter(`${ou} : un mouvement rapproché doit être pointé.`);
      if (!mouvementsDeRapprochement.get(rapprochementId)?.has(id)) e.ajouter(`${ou} : le rapprochement ${rapprochementId} ne liste pas ce mouvement.`);
      const compteR = compteDuRapprochement.get(rapprochementId);
      if (compteR !== compte && compteR !== compteDestination) e.ajouter(`${ou} : le rapprochement ${rapprochementId} concerne un autre compte.`);
    }
    mouvements.push({
      id, exercice, date, dateBilan, type, montant, compte, compteDestination: compteDestination || null, typeTransaction,
      tiers, numeroCheque, numeroFacture, commentaire, pointe, pointeLe, rapprochementId, ventilations,
    });
  });

  // Recoupement inverse : tout mouvement listé par un rapprochement existe et pointe vers lui.
  // (Un mouvement déjà rejeté plus haut est ignoré ici : son erreur est signalée, pas sa conséquence.)
  const rapprochementDeMouvement = new Map(mouvements.map((m) => [m.id, m.rapprochementId]));
  for (const [rid, ids] of mouvementsDeRapprochement) {
    for (const mid of ids) {
      if (!idsMouvements.has(mid)) e.ajouter(`Le rapprochement ${rid} liste le mouvement ${mid}, absent de la sauvegarde.`);
      else if (rapprochementDeMouvement.has(mid) && rapprochementDeMouvement.get(mid) !== rid) e.ajouter(`Le rapprochement ${rid} liste le mouvement ${mid}, qui n'y est pas rattaché.`);
    }
  }

  if (e.total > 0) return { ok: false, erreurs: e.messages };

  const dates = mouvements.map((m) => m.date.toISOString().slice(0, 10)).sort();
  return {
    ok: true,
    donnees: { journaux, categories, exercices, rapprochements, mouvements },
    resume: {
      journaux: journaux.length, categories: categories.length, sousCategories: nbSousCategories, exercices: exercices.length,
      rapprochements: rapprochements.length, mouvements: mouvements.length, premiereDate: dates[0] ?? null, derniereDate: dates[dates.length - 1] ?? null,
    },
  };
}

// ───────────────────────── application ─────────────────────────

export async function associationEstVide(associationId: number): Promise<boolean> {
  const [journaux, categories, exercices, mouvements, rapprochements] = await Promise.all([
    prisma.journal.count({ where: { associationId } }),
    prisma.categorie.count({ where: { associationId } }),
    prisma.exercice.count({ where: { associationId } }),
    prisma.mouvement.count({ where: { associationId } }),
    prisma.rapprochement.count({ where: { associationId } }),
  ]);
  return journaux + categories + exercices + mouvements + rapprochements === 0;
}

export type ResultatImport = { ok: true; resume: ResumeSauvegarde } | { ok: false; erreurs: string[] };

// Lit le texte du fichier, le valide, et si `appliquer` est vrai l'importe dans l'association (vide).
// Sans `appliquer`, ne fait que contrôler et renvoyer le résumé (aperçu avant confirmation).
export async function importerSauvegarde(associationId: number, texte: string, appliquer: boolean): Promise<ResultatImport> {
  if (Buffer.byteLength(texte, "utf8") > TAILLE_MAX_SAUVEGARDE) {
    return { ok: false, erreurs: [`Fichier trop volumineux (${Math.round(TAILLE_MAX_SAUVEGARDE / 1024 / 1024)} Mo au plus).`] };
  }
  let brut: unknown;
  try {
    brut = JSON.parse(texte.replace(/^﻿/, ""));
  } catch {
    return { ok: false, erreurs: ["Le fichier n'est pas un JSON valide."] };
  }

  const validation = validerSauvegarde(brut);
  if (!validation.ok) return validation;
  if (!(await associationEstVide(associationId))) {
    return {
      ok: false,
      erreurs: ["Cette association contient déjà des données : l'import n'est possible que dans une association vide (aucun compte, catégorie, exercice ni mouvement)."],
    };
  }
  if (!appliquer) return { ok: true, resume: validation.resume };

  const d = validation.donnees;
  await prisma.$transaction(
    async (tx) => {
      // Rejoue la vérification dans la transaction : une autre saisie a pu arriver entre-temps.
      const dejaLa =
        (await tx.journal.count({ where: { associationId } })) + (await tx.exercice.count({ where: { associationId } })) +
        (await tx.categorie.count({ where: { associationId } })) + (await tx.mouvement.count({ where: { associationId } }));
      if (dejaLa > 0) throw new Error("L'association n'est plus vide.");

      const journalId = new Map<string, number>();
      for (const j of d.journaux) journalId.set(j.nom, (await tx.journal.create({ data: { associationId, ...j } })).id);

      const sousCategorieId = new Map<string, number>();
      for (const c of d.categories) {
        const cree = await tx.categorie.create({
          data: { associationId, nom: c.nom, type: c.type, actif: c.actif, sousCategories: { create: c.sousCategories } },
          include: { sousCategories: true },
        });
        for (const sc of cree.sousCategories) sousCategorieId.set(`${c.type}\u0000${c.nom}\u0000${sc.nom}`, sc.id);
      }

      const exerciceId = new Map<string, number>();
      for (const x of d.exercices) {
        const cree = await tx.exercice.create({
          data: { associationId, libelle: x.libelle, dateDebut: x.dateDebut, dateFin: x.dateFin, cloture: x.cloture, clotureLe: x.clotureLe },
        });
        exerciceId.set(x.libelle, cree.id);
        if (x.soldesCloture.length > 0) {
          await tx.soldeCloture.createMany({ data: x.soldesCloture.map((s) => ({ exerciceId: cree.id, journalId: journalId.get(s.compte)!, solde: s.solde })) });
        }
      }

      const rapprochementId = new Map<number, number>();
      for (const r of d.rapprochements) {
        const cree = await tx.rapprochement.create({
          data: { associationId, journalId: journalId.get(r.compte)!, date: r.date, solde: r.solde, createdAt: r.valideLe },
        });
        rapprochementId.set(r.id, cree.id);
      }

      // Mouvements par paquets ; les identifiants créés sont relus dans l'ordre d'insertion (l'association
      // était vide) et chaque ligne est recoupée avec la source avant d'y rattacher les ventilations.
      const TAILLE_PAQUET = 1000;
      for (let debut = 0; debut < d.mouvements.length; debut += TAILLE_PAQUET) {
        const paquet = d.mouvements.slice(debut, debut + TAILLE_PAQUET);
        await tx.mouvement.createMany({
          data: paquet.map((m) => ({
            associationId, exerciceId: exerciceId.get(m.exercice)!, journalId: journalId.get(m.compte)!,
            journalDestinationId: m.compteDestination ? journalId.get(m.compteDestination)! : null,
            date: m.date, dateBilan: m.dateBilan, type: m.type, typeTransaction: m.typeTransaction, montant: m.montant,
            tiers: m.tiers, numeroCheque: m.numeroCheque, numeroFacture: m.numeroFacture, commentaire: m.commentaire,
            pointe: m.pointe, pointeLe: m.pointeLe, rapprochementId: m.rapprochementId !== null ? rapprochementId.get(m.rapprochementId)! : null,
          })),
        });
      }
      const crees = await tx.mouvement.findMany({ where: { associationId }, orderBy: { id: "asc" }, select: { id: true, date: true, montant: true, type: true, journalId: true, exerciceId: true } });
      if (crees.length !== d.mouvements.length) throw new Error("Import interrompu : nombre de mouvements inattendu.");
      const ventilations: { mouvementId: number; sousCategorieId: number; montant: number }[] = [];
      d.mouvements.forEach((m, i) => {
        const c = crees[i];
        if (c.montant !== m.montant || c.type !== m.type || c.date.getTime() !== m.date.getTime() || c.journalId !== journalId.get(m.compte) || c.exerciceId !== exerciceId.get(m.exercice)) {
          throw new Error("Import interrompu : les mouvements créés ne correspondent pas à la sauvegarde.");
        }
        for (const v of m.ventilations) {
          ventilations.push({ mouvementId: c.id, sousCategorieId: sousCategorieId.get(`${m.type}\u0000${v.categorie}\u0000${v.sousCategorie}`)!, montant: v.montant });
        }
      });
      for (let debut = 0; debut < ventilations.length; debut += 2000) {
        await tx.mouvementVentilation.createMany({ data: ventilations.slice(debut, debut + 2000) });
      }
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
  return { ok: true, resume: validation.resume };
}
