// Bilan d'un exercice, en comptabilité de trésorerie (pas de bilan comptable actif/passif) :
//  - recettes et dépenses détaillées par catégorie puis sous-catégorie, et le résultat ;
//  - situation de trésorerie par compte : solde à l'ouverture, variation de l'exercice, solde à la
//    clôture (ouverture + variation de tous les comptes = ouverture + résultat, les virements
//    internes se compensant).
//
// Un mouvement appartient à l'exercice où il a été saisi (Mouvement.exerciceId), comme dans l'état
// « Soldes et résultats » : les deux états donnent donc toujours les mêmes totaux. L'ouverture d'un
// compte = son solde d'ouverture initial + tous les mouvements des exercices qui commencent avant
// celui-ci.

import { prisma } from "@/lib/prisma";

export type SousCategorieBilan = { id: number; nom: string; total: number };
export type CategorieBilan = { id: number; nom: string; total: number; sousCategories: SousCategorieBilan[] };
export type BlocBilan = { categories: CategorieBilan[]; total: number };
export type CompteBilan = { journalId: number; nom: string; ouverture: number; variation: number; cloture: number };

export type Bilan = {
  exercice: { id: number; libelle: string; dateDebut: Date; dateFin: Date; cloture: boolean };
  recettes: BlocBilan;
  depenses: BlocBilan;
  resultat: number;
  comptes: CompteBilan[];
  totalOuverture: number;
  totalVariation: number;
  totalCloture: number;
};

const arrondi = (n: number) => Math.round(n * 100) / 100;

type MouvementEffet = { journalId: number; journalDestinationId: number | null; type: string; montant: number };

function ajouterEffets(cumul: Map<number, number>, mouvements: MouvementEffet[]) {
  const ajouter = (id: number, v: number) => cumul.set(id, (cumul.get(id) ?? 0) + v);
  for (const m of mouvements) {
    if (m.type === "recette") ajouter(m.journalId, m.montant);
    else if (m.type === "depense") ajouter(m.journalId, -m.montant);
    else if (m.type === "virement_interne") {
      ajouter(m.journalId, -m.montant);
      if (m.journalDestinationId) ajouter(m.journalDestinationId, m.montant);
    }
  }
}

export async function bilanExercice(associationId: number, exerciceId: number): Promise<Bilan | null> {
  const exercice = await prisma.exercice.findFirst({ where: { id: exerciceId, associationId } });
  if (!exercice) return null;

  const [categories, ventilations, journaux, mouvementsExercice, mouvementsAnterieurs] = await Promise.all([
    prisma.categorie.findMany({
      where: { associationId },
      include: { sousCategories: { orderBy: { nom: "asc" } } },
      orderBy: { nom: "asc" },
    }),
    prisma.mouvementVentilation.groupBy({
      by: ["sousCategorieId"],
      where: { mouvement: { associationId, exerciceId } },
      _sum: { montant: true },
    }),
    prisma.journal.findMany({ where: { associationId }, orderBy: { nom: "asc" } }),
    prisma.mouvement.findMany({
      where: { associationId, exerciceId },
      select: { journalId: true, journalDestinationId: true, type: true, montant: true },
    }),
    prisma.mouvement.findMany({
      where: { associationId, exercice: { dateDebut: { lt: exercice.dateDebut } } },
      select: { journalId: true, journalDestinationId: true, type: true, montant: true },
    }),
  ]);

  const totalParSousCategorie = new Map(ventilations.map((v) => [v.sousCategorieId, v._sum.montant ?? 0]));

  const bloc = (type: "recette" | "depense"): BlocBilan => {
    const liste: CategorieBilan[] = [];
    for (const c of categories.filter((x) => x.type === type)) {
      const sousCategories = c.sousCategories
        .map((sc) => ({ id: sc.id, nom: sc.nom, total: arrondi(totalParSousCategorie.get(sc.id) ?? 0) }))
        .filter((sc) => sc.total !== 0);
      if (sousCategories.length === 0) continue;
      liste.push({ id: c.id, nom: c.nom, total: arrondi(sousCategories.reduce((s, sc) => s + sc.total, 0)), sousCategories });
    }
    return { categories: liste, total: arrondi(liste.reduce((s, c) => s + c.total, 0)) };
  };
  const recettes = bloc("recette");
  const depenses = bloc("depense");

  const variations = new Map<number, number>();
  ajouterEffets(variations, mouvementsExercice);
  const ouvertures = new Map<number, number>(journaux.map((j) => [j.id, j.soldeInitial]));
  ajouterEffets(ouvertures, mouvementsAnterieurs);

  const comptes: CompteBilan[] = journaux.map((j) => {
    const ouverture = arrondi(ouvertures.get(j.id) ?? 0);
    const variation = arrondi(variations.get(j.id) ?? 0);
    return { journalId: j.id, nom: j.nom, ouverture, variation, cloture: arrondi(ouverture + variation) };
  });

  return {
    exercice: { id: exercice.id, libelle: exercice.libelle, dateDebut: exercice.dateDebut, dateFin: exercice.dateFin, cloture: exercice.cloture },
    recettes,
    depenses,
    resultat: arrondi(recettes.total - depenses.total),
    comptes,
    totalOuverture: arrondi(comptes.reduce((s, c) => s + c.ouverture, 0)),
    totalVariation: arrondi(comptes.reduce((s, c) => s + c.variation, 0)),
    totalCloture: arrondi(comptes.reduce((s, c) => s + c.cloture, 0)),
  };
}
