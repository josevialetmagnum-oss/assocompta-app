// Lecture des paramètres de l'état « Analyse par lignes » (période + lignes `rec`/`dep` répétées dans
// l'adresse), partagée par la page et par l'export PDF pour que les deux montrent la même chose.

import type { LigneAnalyseDemandee } from "@/lib/analyse";

export type ParametresAnalyseBruts = { du?: string; au?: string; rec?: string | string[]; dep?: string | string[] };
export type LigneSaisieAnalyse = { rec: string; dep: string };

const liste = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v === undefined ? [] : [v]);
const dateValide = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime()) ? v : null);
const idOuNull = (v: string | undefined) => (v && Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);
const jour = (d: Date) => d.toISOString().slice(0, 10);

export function lireParametresAnalyse(
  sp: ParametresAnalyseBruts,
  exerciceParDefaut: { dateDebut: Date; dateFin: Date } | null,
): { du: string; au: string; saisies: LigneSaisieAnalyse[]; demandees: LigneAnalyseDemandee[]; periodeInvalide: boolean } {
  const du = dateValide(sp.du) ?? (exerciceParDefaut ? jour(exerciceParDefaut.dateDebut) : jour(new Date()));
  const au = dateValide(sp.au) ?? (exerciceParDefaut ? jour(exerciceParDefaut.dateFin) : jour(new Date()));

  const recs = liste(sp.rec);
  const deps = liste(sp.dep);
  const nombre = Math.max(recs.length, deps.length);
  const saisies: LigneSaisieAnalyse[] = Array.from({ length: nombre }, (_, i) => ({ rec: recs[i] ?? "", dep: deps[i] ?? "" }));
  const demandees: LigneAnalyseDemandee[] = saisies.map((l) => ({
    sousCategorieRecetteId: idOuNull(l.rec),
    sousCategorieDepenseId: idOuNull(l.dep),
  }));
  return { du, au, saisies, demandees, periodeInvalide: new Date(au).getTime() < new Date(du).getTime() };
}
