// Rapprochement bancaire par étapes (voir cahier des charges, précisé le 01/10/2026) :
//  - Un dernier rapprochement validé fige une date et un solde de référence (ou, à défaut, le solde
//    d'ouverture du journal si aucun rapprochement n'a encore été fait).
//  - Entre deux rapprochements, l'écart = (solde du nouveau relevé - solde du dernier rapprochement)
//    - la somme des mouvements déjà pointés mais pas encore rattachés à un rapprochement (datés au
//    plus tard à la date du relevé). Il se recalcule à chaque pointage.
//  - On ne peut valider (créer le nouveau rapprochement) que si cet écart est exactement nul.
//  - Valider rattache tous ces mouvements au nouveau rapprochement : ils sont alors verrouillés,
//    seule la suppression de ce rapprochement les libère tous ensemble (jamais un dépointage
//    individuel — voir basculerPointage, src/app/mouvements/actions.ts).

import { prisma } from "@/lib/prisma";

export type DernierRapprochement = { id: number; date: Date; solde: number } | null;

export async function dernierRapprochement(associationId: number, journalId: number): Promise<DernierRapprochement> {
  const r = await prisma.rapprochement.findFirst({
    where: { associationId, journalId },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });
  return r ? { id: r.id, date: r.date, solde: r.solde } : null;
}

// Point de départ du rapprochement en cours : le dernier rapprochement validé, ou à défaut le solde
// d'ouverture du journal (aucune date dans ce cas — il n'y a encore jamais eu de rapprochement).
export async function soldeBaseRapprochement(associationId: number, journalId: number): Promise<{ date: Date | null; solde: number }> {
  const dernier = await dernierRapprochement(associationId, journalId);
  if (dernier) return { date: dernier.date, solde: dernier.solde };
  const journal = await prisma.journal.findFirst({ where: { id: journalId, associationId } });
  if (!journal) throw new Error("Journal introuvable.");
  return { date: null, solde: journal.soldeInitial };
}

export type LigneHistorique = { id: number; date: Date; solde: number; valideLe: Date; nombreMouvements: number };

// Historique des rapprochements d'un compte, du plus récent au plus ancien (même ordre que
// dernierRapprochement : le premier de la liste est le seul que l'on peut supprimer).
export async function listerRapprochements(associationId: number, journalId: number): Promise<LigneHistorique[]> {
  const lignes = await prisma.rapprochement.findMany({
    where: { associationId, journalId },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    include: { _count: { select: { mouvements: true } } },
  });
  return lignes.map((r) => ({ id: r.id, date: r.date, solde: r.solde, valideLe: r.createdAt, nombreMouvements: r._count.mouvements }));
}

// Mouvements rattachés à un rapprochement (cloisonné par association).
export async function mouvementsDuRapprochement(associationId: number, rapprochementId: number) {
  return prisma.mouvement.findMany({
    where: { associationId, rapprochementId },
    include: { journal: true, journalDestination: true, ventilations: { include: { sousCategorie: { include: { categorie: true } } } } },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });
}

type MouvementDirection = { journalId: number; journalDestinationId: number | null; type: "recette" | "depense" | "virement_interne"; montant: number };

function effetSurJournal(m: MouvementDirection, journalId: number): number {
  if (m.journalId === journalId) {
    if (m.type === "recette") return m.montant;
    if (m.type === "depense") return -m.montant;
    return -m.montant; // virement_interne, côté source
  }
  if (m.journalDestinationId === journalId) return m.montant; // virement_interne, côté destination
  return 0;
}

// Mouvements pas encore rattachés à un rapprochement (qu'ils soient déjà pointés ou non), datés au
// plus tard à dateLimite — ce que l'écran de rapprochement propose de pointer/dépointer.
export async function mouvementsNonRapprochesJournal(associationId: number, journalId: number, dateLimite: Date) {
  return prisma.mouvement.findMany({
    where: {
      associationId,
      rapprochementId: null,
      date: { lte: dateLimite },
      OR: [{ journalId }, { journalDestinationId: journalId }],
    },
    include: { journal: true, journalDestination: true, ventilations: { include: { sousCategorie: { include: { categorie: true } } } } },
    orderBy: { date: "asc" },
  });
}

async function sommeNonRapprochesPointes(associationId: number, journalId: number, dateLimite: Date): Promise<number> {
  const mouvements = await prisma.mouvement.findMany({
    where: {
      associationId,
      rapprochementId: null,
      pointe: true,
      date: { lte: dateLimite },
      OR: [{ journalId }, { journalDestinationId: journalId }],
    },
    select: { journalId: true, journalDestinationId: true, type: true, montant: true },
  });
  return Math.round(mouvements.reduce((s, m) => s + effetSurJournal(m, journalId), 0) * 100) / 100;
}

// Écart restant à résorber avant de pouvoir valider : diminue à chaque mouvement pointé, doit
// atteindre exactement 0.
export async function ecartRapprochement(associationId: number, journalId: number, dateReleve: Date, soldeReleve: number): Promise<number> {
  const base = await soldeBaseRapprochement(associationId, journalId);
  const pointes = await sommeNonRapprochesPointes(associationId, journalId, dateReleve);
  return Math.round((soldeReleve - base.solde - pointes) * 100) / 100;
}

export type ResultatValidation = { ok: true } | { ok: false; erreur: string };

// Valide le rapprochement en cours : revérifie tout côté serveur (jamais fait confiance à ce que
// l'écran affichait), crée le Rapprochement, et y rattache tous les mouvements qui viennent d'être
// soldés par ce calcul.
export async function validerRapprochement(
  associationId: number,
  journalId: number,
  dateReleve: Date,
  soldeReleve: number,
): Promise<ResultatValidation> {
  const base = await soldeBaseRapprochement(associationId, journalId);
  if (base.date && dateReleve.getTime() < base.date.getTime()) {
    return { ok: false, erreur: "La date du relevé doit être postérieure à celle du dernier rapprochement." };
  }
  const ecart = await ecartRapprochement(associationId, journalId, dateReleve, soldeReleve);
  if (ecart !== 0) {
    return { ok: false, erreur: `L'écart doit être nul pour valider (actuellement ${ecart.toFixed(2)} €).` };
  }

  const aRattacher = await prisma.mouvement.findMany({
    where: {
      associationId,
      rapprochementId: null,
      pointe: true,
      date: { lte: dateReleve },
      OR: [{ journalId }, { journalDestinationId: journalId }],
    },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    const rapprochement = await tx.rapprochement.create({ data: { associationId, journalId, date: dateReleve, solde: soldeReleve } });
    await tx.mouvement.updateMany({
      where: { id: { in: aRattacher.map((m) => m.id) } },
      data: { rapprochementId: rapprochement.id },
    });
  });
  return { ok: true };
}

// Supprime le dernier rapprochement du journal : dépointe tous les mouvements qui y étaient
// rattachés (jamais ceux d'un rapprochement antérieur) avant de le supprimer.
// Si `rapprochementId` est fourni, il doit être bien le dernier : la page affichée peut dater (un
// autre rapprochement a pu être validé ou supprimé entre-temps), on ne supprime jamais « un autre ».
export async function supprimerDernierRapprochement(
  associationId: number,
  journalId: number,
  rapprochementId?: number,
): Promise<ResultatValidation> {
  const dernier = await dernierRapprochement(associationId, journalId);
  if (!dernier) return { ok: false, erreur: "Aucun rapprochement à supprimer pour ce journal." };
  if (rapprochementId !== undefined && dernier.id !== rapprochementId) {
    return { ok: false, erreur: "Ce rapprochement n'est plus le dernier : rechargez la page." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.mouvement.updateMany({
      where: { rapprochementId: dernier.id },
      data: { pointe: false, pointeLe: null, rapprochementId: null },
    });
    await tx.rapprochement.delete({ where: { id: dernier.id } });
  });
  return { ok: true };
}
