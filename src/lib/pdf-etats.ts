// Mise en page PDF des états. Chaque fonction reçoit des données déjà chargées (et cloisonnées par
// association par l'appelant) et renvoie le document prêt à être sérialisé (`.octets()`).

import type { Bilan, BlocBilan } from "@/lib/bilan";
import type { ResultatAnalyse } from "@/lib/analyse";
import type { LigneResultat, SituationTresorerie, SoldeJournal } from "@/lib/tresorerie";
import { DocumentPdf, type LigneTableau } from "@/lib/pdf";

export const fmtMontant = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const fmtDate = (d: Date) => d.toLocaleDateString("fr-FR");

function lignesBloc(titre: string, bloc: BlocBilan, vide: string): LigneTableau[] {
  const lignes: LigneTableau[] = [{ cellules: [titre, ""], style: "section" }];
  if (bloc.categories.length === 0) lignes.push({ cellules: [vide, ""], style: "normal" });
  for (const c of bloc.categories) {
    lignes.push({ cellules: [c.nom, fmtMontant(c.total)], style: "categorie" });
    for (const sc of c.sousCategories) lignes.push({ cellules: [sc.nom, fmtMontant(sc.total)], style: "sous" });
  }
  lignes.push({ cellules: [`Total ${titre.toLowerCase()}`, fmtMontant(bloc.total)], style: "total" });
  return lignes;
}

export async function pdfBilan(bilan: Bilan, association: string, edite: Date = new Date()): Promise<DocumentPdf> {
  const e = bilan.exercice;
  const doc = await DocumentPdf.creer({
    association,
    titre: `Bilan — ${e.libelle}`,
    sousTitre: `Du ${fmtDate(e.dateDebut)} au ${fmtDate(e.dateFin)}${e.cloture ? " (exercice clôturé)" : ""}`,
    edite,
  });

  doc.tableau(
    [{ titre: "Catégorie / sous-catégorie", poids: 4 }, { titre: "Montant", poids: 1.4, alignement: "droite" }],
    [
      ...lignesBloc("Recettes", bilan.recettes, "Aucune recette sur cet exercice."),
      ...lignesBloc("Dépenses", bilan.depenses, "Aucune dépense sur cet exercice."),
      { cellules: [bilan.resultat >= 0 ? "Résultat de l'exercice (excédent)" : "Résultat de l'exercice (déficit)", fmtMontant(bilan.resultat)], style: "total" },
    ],
  );

  doc.sousTitre("Situation de trésorerie");
  doc.tableau(
    [
      { titre: "Compte", poids: 3 },
      { titre: "Ouverture", poids: 1.4, alignement: "droite" },
      { titre: "Variation", poids: 1.4, alignement: "droite" },
      { titre: "Clôture", poids: 1.4, alignement: "droite" },
    ],
    [
      ...bilan.comptes.map((c): LigneTableau => ({ cellules: [c.nom, fmtMontant(c.ouverture), fmtMontant(c.variation), fmtMontant(c.cloture)] })),
      { cellules: ["Total", fmtMontant(bilan.totalOuverture), fmtMontant(bilan.totalVariation), fmtMontant(bilan.totalCloture)], style: "total" },
    ],
  );
  return doc;
}

export async function pdfAnalyse(
  resultat: ResultatAnalyse,
  periode: { du: Date; au: Date },
  association: string,
  edite: Date = new Date(),
): Promise<DocumentPdf> {
  const doc = await DocumentPdf.creer({
    association,
    titre: "Analyse par lignes",
    sousTitre: `Du ${fmtDate(periode.du)} au ${fmtDate(periode.au)} (date bilan des mouvements)`,
    edite,
  });
  if (resultat.doublons.length > 0) {
    doc.paragraphe(`Attention : ${resultat.doublons.join(", ")} apparaît sur plusieurs lignes, son montant est compté à chaque fois dans le total.`, { gras: true });
    doc.espace(4);
  }
  doc.tableau(
    [
      { titre: "Recette", poids: 4 },
      { titre: "Montant", poids: 1.5, alignement: "droite" },
      { titre: "Dépense", poids: 4 },
      { titre: "Montant", poids: 1.5, alignement: "droite" },
      { titre: "Différence", poids: 1.6, alignement: "droite" },
    ],
    resultat.lignes.length === 0
      ? [{ cellules: ["Aucune sous-catégorie choisie.", "", "", "", ""] }]
      : [
          ...resultat.lignes.map((l): LigneTableau => ({
            cellules: [l.recette?.libelle ?? "—", l.recette ? fmtMontant(l.recette.total) : "", l.depense?.libelle ?? "—", l.depense ? fmtMontant(l.depense.total) : "", fmtMontant(l.difference)],
          })),
          { cellules: ["Total recettes", fmtMontant(resultat.totalRecettes), "Total dépenses", fmtMontant(resultat.totalDepenses), fmtMontant(resultat.difference)], style: "total" },
        ],
  );
  return doc;
}

export async function pdfSoldesEtResultats(
  donnees: {
    exercice: { libelle: string; dateDebut: Date; dateFin: Date };
    soldes: SoldeJournal[];
    lignes: LigneResultat[];
    situation: SituationTresorerie;
  },
  association: string,
  edite: Date = new Date(),
): Promise<DocumentPdf> {
  const { exercice, soldes, lignes, situation } = donnees;
  const doc = await DocumentPdf.creer({
    association,
    titre: "Soldes et résultats",
    sousTitre: `Exercice ${exercice.libelle} — du ${fmtDate(exercice.dateDebut)} au ${fmtDate(exercice.dateFin)}`,
    edite,
  });

  const totalSoldes = Math.round(soldes.reduce((s, j) => s + j.solde, 0) * 100) / 100;
  doc.sousTitre(`Soldes des comptes au ${fmtDate(edite)}`);
  doc.tableau(
    [{ titre: "Compte", poids: 4 }, { titre: "Solde", poids: 1.4, alignement: "droite" }],
    [...soldes.map((j): LigneTableau => ({ cellules: [j.nom, fmtMontant(j.solde)] })), { cellules: ["Total", fmtMontant(totalSoldes)], style: "total" }],
  );

  doc.sousTitre(`Résultat analytique — ${exercice.libelle}`);
  doc.tableau(
    [{ titre: "Catégorie", poids: 4 }, { titre: "Type", poids: 1.4 }, { titre: "Montant", poids: 1.4, alignement: "droite" }],
    lignes.length === 0
      ? [{ cellules: ["Aucun mouvement sur cet exercice.", "", ""] }]
      : lignes.map((l): LigneTableau => ({ cellules: [l.nom, l.type === "recette" ? "Recette" : "Dépense", fmtMontant(l.total)] })),
  );

  doc.sousTitre(`Situation de trésorerie — ${exercice.libelle}`);
  doc.tableau(
    [{ titre: "", poids: 4 }, { titre: "Montant", poids: 1.4, alignement: "droite" }],
    [
      { cellules: ["Total recettes", fmtMontant(situation.totalRecettes)] },
      { cellules: ["Total dépenses", fmtMontant(situation.totalDepenses)] },
      { cellules: ["Résultat", fmtMontant(situation.resultat)], style: "total" },
    ],
  );
  return doc;
}
