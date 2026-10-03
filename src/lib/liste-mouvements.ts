// Liste filtrée des mouvements, partagée par l'écran et l'export PDF pour qu'ils montrent la même chose.

import { prisma } from "@/lib/prisma";

export type FiltreMouvements = { journalId?: number; exerciceId?: number };

// Lecture des filtres de l'adresse (?journal=…&exercice=…).
//  - exercice absent  → exercice en cours (comportement par défaut de l'écran) ;
//  - exercice vide    → « Tous » les exercices (choix explicite dans la liste) ;
//  - sinon            → l'exercice demandé.
// Un identifiant illisible est ignoré plutôt que de planter.
export function lireFiltreMouvements(
  sp: { journal?: string; exercice?: string },
  exerciceParDefautId: number | undefined,
): FiltreMouvements {
  const entier = (v: string | undefined) => (v && Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : undefined);
  return {
    journalId: entier(sp.journal),
    exerciceId: sp.exercice === undefined ? exerciceParDefautId : entier(sp.exercice),
  };
}

export async function listerMouvementsFiltres(associationId: number, filtre: FiltreMouvements, ordre: "asc" | "desc" = "desc") {
  return prisma.mouvement.findMany({
    where: {
      associationId,
      ...(filtre.journalId ? { journalId: filtre.journalId } : {}),
      ...(filtre.exerciceId ? { exerciceId: filtre.exerciceId } : {}),
    },
    include: { journal: true, journalDestination: true, ventilations: { include: { sousCategorie: { include: { categorie: true } } } } },
    orderBy: [{ date: ordre }, { id: ordre }],
  });
}
