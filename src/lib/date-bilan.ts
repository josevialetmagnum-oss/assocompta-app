// Date bilan (date prise en compte pour le bilan) — distincte de la date de saisie du mouvement,
// pour permettre de corriger un exercice déjà passé ou d'anticiper sur le suivant sans perturber la
// chronologie des rapports : voir cahier des charges (§ Période en cours/précédent/suivant).
//
//  - Exercice en cours (celui du mouvement = l'exercice actif) : date bilan = date de saisie.
//  - Exercice précédent (dateDebut antérieure à celle de l'exercice actif) : date bilan = la veille
//    du début de l'exercice en cours — toute correction d'un exercice déjà passé se range ainsi au
//    dernier jour de ce dernier, quelle que soit la date réellement saisie.
//  - Exercice suivant (dateDebut postérieure) : date bilan = le lendemain de la fin de l'exercice en
//    cours — symétrique, pour une anticipation sur l'exercice suivant.

export type ExerciceRepere = { id: number; dateDebut: Date; dateFin: Date };

function ajouterJours(date: Date, jours: number): Date {
  const copie = new Date(date);
  copie.setDate(copie.getDate() + jours);
  return copie;
}

export function calculerDateBilan(
  dateSaisie: Date,
  exerciceMouvement: ExerciceRepere,
  exerciceActif: ExerciceRepere | null,
): Date {
  if (!exerciceActif || exerciceMouvement.id === exerciceActif.id) return dateSaisie;
  if (exerciceMouvement.dateDebut.getTime() < exerciceActif.dateDebut.getTime()) {
    return ajouterJours(exerciceActif.dateDebut, -1);
  }
  return ajouterJours(exerciceActif.dateFin, 1);
}
