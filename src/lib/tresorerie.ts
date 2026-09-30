// Calculs de trésorerie : soldes des comptes (temps réel, toutes exercices confondus) et résultat
// analytique par catégorie/sous-catégorie (pour un exercice donné). Comptabilité de trésorerie
// simple (pas d'engagement) : un mouvement compte à la date où il est enregistré, point.

import { prisma } from "@/lib/prisma";

export async function exerciceActif(associationId: number) {
  const maintenant = new Date();
  const enCours = await prisma.exercice.findFirst({
    where: { associationId, cloture: false, dateDebut: { lte: maintenant }, dateFin: { gte: maintenant } },
    orderBy: { dateDebut: "desc" },
  });
  if (enCours) return enCours;
  return prisma.exercice.findFirst({ where: { associationId, cloture: false }, orderBy: { dateDebut: "desc" } });
}

// Autorise la saisie des soldes d'ouverture des journaux à la création d'un exercice : seulement
// si l'exercice précédent (le plus récent déjà créé, s'il y en a un) n'a reçu aucun mouvement —
// reprise d'un compte existant avant tout usage de l'application, ou premier exercice de
// l'association. Dès qu'un exercice a été utilisé, le solde se déduit des mouvements (voir
// soldesJournaux) et ne doit plus être modifié à la main, pour ne jamais corrompre l'historique.
export async function autoriseSoldesOuverture(associationId: number): Promise<boolean> {
  const precedent = await prisma.exercice.findFirst({ where: { associationId }, orderBy: { dateDebut: "desc" } });
  if (!precedent) return true;
  const nombreMouvements = await prisma.mouvement.count({ where: { exerciceId: precedent.id } });
  return nombreMouvements === 0;
}

export type SoldeJournal = { journalId: number; nom: string; solde: number };

// Solde de chaque journal, toutes exercices confondus (§ "soldes des comptes en temps réel").
export async function soldesJournaux(associationId: number): Promise<SoldeJournal[]> {
  const journaux = await prisma.journal.findMany({ where: { associationId }, orderBy: { nom: "asc" } });
  const mouvements = await prisma.mouvement.findMany({
    where: { associationId },
    select: { journalId: true, journalDestinationId: true, type: true, montant: true },
  });

  const soldes = new Map<number, number>(journaux.map((j) => [j.id, j.soldeInitial]));
  for (const m of mouvements) {
    if (m.type === "recette") soldes.set(m.journalId, (soldes.get(m.journalId) ?? 0) + m.montant);
    else if (m.type === "depense") soldes.set(m.journalId, (soldes.get(m.journalId) ?? 0) - m.montant);
    else if (m.type === "virement_interne") {
      soldes.set(m.journalId, (soldes.get(m.journalId) ?? 0) - m.montant);
      if (m.journalDestinationId) soldes.set(m.journalDestinationId, (soldes.get(m.journalDestinationId) ?? 0) + m.montant);
    }
  }
  return journaux.map((j) => ({ journalId: j.id, nom: j.nom, solde: Math.round((soldes.get(j.id) ?? 0) * 100) / 100 }));
}

// Solde pointé d'UN journal à une date donnée (rapprochement bancaire) : somme du solde
// d'ouverture et des seuls mouvements déjà rapprochés (pointe = true), datés au plus tard à
// dateLimite — à comparer au solde du relevé bancaire pour cette même date. Un virement interne
// compte pour les deux journaux qu'il touche (source et destination), comme soldesJournaux().
export async function soldePointeJournal(associationId: number, journalId: number, dateLimite: Date): Promise<number> {
  const journal = await prisma.journal.findFirst({ where: { id: journalId, associationId } });
  if (!journal) throw new Error("Journal introuvable.");

  const mouvements = await prisma.mouvement.findMany({
    where: {
      associationId,
      pointe: true,
      date: { lte: dateLimite },
      OR: [{ journalId }, { journalDestinationId: journalId }],
    },
    select: { journalId: true, journalDestinationId: true, type: true, montant: true },
  });

  let solde = journal.soldeInitial;
  for (const m of mouvements) {
    if (m.journalId === journalId) {
      if (m.type === "recette") solde += m.montant;
      else if (m.type === "depense") solde -= m.montant;
      else if (m.type === "virement_interne") solde -= m.montant;
    } else if (m.journalDestinationId === journalId) {
      solde += m.montant;
    }
  }
  return Math.round(solde * 100) / 100;
}

export type LigneResultat = { categorieId: number; nom: string; type: "recette" | "depense"; total: number };

// Résultat analytique par catégorie, pour un exercice donné (§ "résultat analytique").
export async function resultatParCategorie(associationId: number, exerciceId: number): Promise<LigneResultat[]> {
  const categories = await prisma.categorie.findMany({
    where: { associationId },
    include: { sousCategories: true },
    orderBy: [{ type: "asc" }, { nom: "asc" }],
  });
  const sousCategorieVersCategorie = new Map<number, number>();
  for (const c of categories) for (const sc of c.sousCategories) sousCategorieVersCategorie.set(sc.id, c.id);

  const ventilations = await prisma.mouvementVentilation.findMany({
    where: { mouvement: { associationId, exerciceId } },
    select: { montant: true, sousCategorieId: true },
  });

  const totaux = new Map<number, number>();
  for (const v of ventilations) {
    const categorieId = sousCategorieVersCategorie.get(v.sousCategorieId);
    if (categorieId === undefined) continue;
    totaux.set(categorieId, (totaux.get(categorieId) ?? 0) + v.montant);
  }

  return categories
    .filter((c) => (totaux.get(c.id) ?? 0) !== 0)
    .map((c) => ({ categorieId: c.id, nom: c.nom, type: c.type as "recette" | "depense", total: Math.round((totaux.get(c.id) ?? 0) * 100) / 100 }));
}

export type SituationTresorerie = { totalRecettes: number; totalDepenses: number; resultat: number };

export async function situationTresorerie(associationId: number, exerciceId: number): Promise<SituationTresorerie> {
  const lignes = await resultatParCategorie(associationId, exerciceId);
  const totalRecettes = Math.round(lignes.filter((l) => l.type === "recette").reduce((s, l) => s + l.total, 0) * 100) / 100;
  const totalDepenses = Math.round(lignes.filter((l) => l.type === "depense").reduce((s, l) => s + l.total, 0) * 100) / 100;
  return { totalRecettes, totalDepenses, resultat: Math.round((totalRecettes - totalDepenses) * 100) / 100 };
}
