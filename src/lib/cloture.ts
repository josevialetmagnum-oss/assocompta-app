// Clôture et réouverture d'un exercice.
//
// Clôturer fige le solde de chaque compte à la fin de l'exercice (SoldeCloture) : ces soldes sont
// reportés tels quels en ouverture de l'exercice suivant (voir src/lib/bilan.ts). On clôture dans
// l'ordre chronologique — jamais un exercice tant qu'un exercice antérieur est encore ouvert, sinon
// les soldes reportés pourraient encore bouger.
//
// Rouvrir un exercice annule sa clôture, et celle de tous les exercices suivants déjà clôturés (leurs
// soldes d'ouverture dépendaient du sien) ; leurs soldes figés sont supprimés puis recalculés à la
// prochaine clôture.

import { prisma } from "@/lib/prisma";
import { bilanExercice } from "@/lib/bilan";

export type ResultatCloture = { ok: true } | { ok: false; erreur: string };

export async function cloturerExerciceAssociation(associationId: number, exerciceId: number): Promise<ResultatCloture> {
  const exercice = await prisma.exercice.findFirst({ where: { id: exerciceId, associationId } });
  if (!exercice) return { ok: false, erreur: "Exercice introuvable." };
  if (exercice.cloture) return { ok: false, erreur: "Cet exercice est déjà clôturé." };

  const anterieurOuvert = await prisma.exercice.findFirst({
    where: { associationId, cloture: false, dateDebut: { lt: exercice.dateDebut } },
    orderBy: { dateDebut: "asc" },
  });
  if (anterieurOuvert) {
    return { ok: false, erreur: `Clôturez d'abord l'exercice ${anterieurOuvert.libelle} : les soldes se reportent dans l'ordre.` };
  }

  const bilan = await bilanExercice(associationId, exerciceId);
  if (!bilan) return { ok: false, erreur: "Exercice introuvable." };

  await prisma.$transaction(async (tx) => {
    await tx.soldeCloture.deleteMany({ where: { exerciceId } });
    await tx.soldeCloture.createMany({
      data: bilan.comptes.map((c) => ({ exerciceId, journalId: c.journalId, solde: c.cloture })),
    });
    await tx.exercice.update({ where: { id: exerciceId }, data: { cloture: true, clotureLe: new Date() } });
  });
  return { ok: true };
}

// Renvoie les libellés des exercices rouverts (l'exercice demandé en premier).
export async function rouvrirExerciceAssociation(
  associationId: number,
  exerciceId: number,
): Promise<{ ok: true; rouverts: string[] } | { ok: false; erreur: string }> {
  const exercice = await prisma.exercice.findFirst({ where: { id: exerciceId, associationId } });
  if (!exercice) return { ok: false, erreur: "Exercice introuvable." };
  if (!exercice.cloture) return { ok: false, erreur: "Cet exercice n'est pas clôturé." };

  const concernes = await prisma.exercice.findMany({
    where: { associationId, cloture: true, dateDebut: { gte: exercice.dateDebut } },
    orderBy: { dateDebut: "asc" },
  });
  const ids = concernes.map((e) => e.id);

  await prisma.$transaction(async (tx) => {
    await tx.soldeCloture.deleteMany({ where: { exerciceId: { in: ids } } });
    await tx.exercice.updateMany({ where: { id: { in: ids } }, data: { cloture: false, clotureLe: null } });
  });
  return { ok: true, rouverts: concernes.map((e) => e.libelle) };
}
