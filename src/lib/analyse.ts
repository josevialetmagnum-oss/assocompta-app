// Analyse par lignes : le trésorier compose lui-même des lignes (une sous-catégorie de recette et/ou
// une sous-catégorie de dépense par ligne), choisit une période, et obtient pour chaque ligne le
// cumul des recettes, le cumul des dépenses et leur différence, puis le total général.
//
// La période porte sur la date bilan des mouvements (la date prise en compte pour le bilan, voir
// src/lib/date-bilan.ts), pas sur la date de saisie : c'est elle qui rattache un mouvement à un
// exercice dans les autres états.

import { prisma } from "@/lib/prisma";

export type LigneAnalyseDemandee = { sousCategorieRecetteId: number | null; sousCategorieDepenseId: number | null };

export type MontantSousCategorie = { id: number; libelle: string; total: number };

export type LigneAnalyse = {
  recette: MontantSousCategorie | null;
  depense: MontantSousCategorie | null;
  difference: number;
};

export type ResultatAnalyse = {
  lignes: LigneAnalyse[];
  totalRecettes: number;
  totalDepenses: number;
  difference: number;
  // Sous-catégories choisies sur plusieurs lignes : leur montant est compté à chaque fois dans le total.
  doublons: string[];
};

const arrondi = (n: number) => Math.round(n * 100) / 100;

export async function analyseParLignes(
  associationId: number,
  du: Date,
  au: Date,
  demandees: LigneAnalyseDemandee[],
): Promise<ResultatAnalyse> {
  const ids = [...new Set(demandees.flatMap((l) => [l.sousCategorieRecetteId, l.sousCategorieDepenseId]).filter((id): id is number => id !== null))];

  // Le filtre sur l'association garantit qu'on ne lit jamais la sous-catégorie d'une autre association ;
  // le type de la catégorie garantit qu'une colonne « recette » ne reçoit jamais une dépense (et inversement).
  const sousCategories = ids.length
    ? await prisma.sousCategorie.findMany({ where: { id: { in: ids }, categorie: { associationId } }, include: { categorie: true } })
    : [];
  const parId = new Map(sousCategories.map((sc) => [sc.id, sc]));

  const sommes = ids.length
    ? await prisma.mouvementVentilation.groupBy({
        by: ["sousCategorieId"],
        where: { sousCategorieId: { in: sousCategories.map((sc) => sc.id) }, mouvement: { associationId, dateBilan: { gte: du, lte: au } } },
        _sum: { montant: true },
      })
    : [];
  const totalParId = new Map(sommes.map((s) => [s.sousCategorieId, s._sum.montant ?? 0]));

  const trouver = (id: number | null, type: "recette" | "depense"): MontantSousCategorie | null => {
    if (id === null) return null;
    const sc = parId.get(id);
    if (!sc || sc.categorie.type !== type) return null;
    return { id: sc.id, libelle: `${sc.categorie.nom} — ${sc.nom}`, total: arrondi(totalParId.get(id) ?? 0) };
  };

  const lignes: LigneAnalyse[] = demandees
    .map((d) => {
      const recette = trouver(d.sousCategorieRecetteId, "recette");
      const depense = trouver(d.sousCategorieDepenseId, "depense");
      return { recette, depense, difference: arrondi((recette?.total ?? 0) - (depense?.total ?? 0)) };
    })
    .filter((l) => l.recette !== null || l.depense !== null);

  const totalRecettes = arrondi(lignes.reduce((s, l) => s + (l.recette?.total ?? 0), 0));
  const totalDepenses = arrondi(lignes.reduce((s, l) => s + (l.depense?.total ?? 0), 0));

  const vus = new Set<number>();
  const doublons = new Set<string>();
  for (const l of lignes) {
    for (const m of [l.recette, l.depense]) {
      if (!m) continue;
      if (vus.has(m.id)) doublons.add(m.libelle);
      vus.add(m.id);
    }
  }

  return { lignes, totalRecettes, totalDepenses, difference: arrondi(totalRecettes - totalDepenses), doublons: [...doublons] };
}
