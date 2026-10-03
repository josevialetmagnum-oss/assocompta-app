// PDF des écrans de saisie : liste des mouvements et état de rapprochement. Même principe que
// pdf-etats.ts : données déjà chargées (et cloisonnées par association) en entrée, document en sortie.

import { DocumentPdf, type LigneTableau } from "@/lib/pdf";
import { fmtMontant } from "@/lib/pdf-etats";

const fmtDate = (d: Date) => d.toLocaleDateString("fr-FR");
const LIBELLE_TYPE = { recette: "Recette", depense: "Dépense", virement_interne: "Virement" } as const;

export type MouvementListe = {
  date: Date;
  type: keyof typeof LIBELLE_TYPE;
  montant: number;
  tiers: string | null;
  pointe: boolean;
  rapprochementId: number | null;
  journal: { nom: string };
  journalDestination: { nom: string } | null;
  ventilations: { sousCategorie: { nom: string; categorie: { nom: string } } }[];
};

function libelle(m: MouvementListe): string {
  if (m.type === "virement_interne") return `${m.journal.nom} → ${m.journalDestination?.nom ?? "?"}`;
  const categories = m.ventilations.map((v) => `${v.sousCategorie.categorie.nom} — ${v.sousCategorie.nom}`).join(" ; ");
  return [categories, m.tiers].filter(Boolean).join(" · ") || "—";
}

const pointage = (m: MouvementListe) => (m.rapprochementId !== null ? "Rapproché" : m.pointe ? "Pointé" : "");

const COLONNES_MOUVEMENTS = [
  { titre: "Date", poids: 1.2 },
  { titre: "Compte", poids: 1.6 },
  { titre: "Type", poids: 1.1 },
  { titre: "Catégorie / tiers", poids: 4 },
  { titre: "Montant", poids: 1.5, alignement: "droite" as const },
  { titre: "Pointage", poids: 1.3 },
];

function ligneMouvement(m: MouvementListe): LigneTableau {
  return { cellules: [fmtDate(m.date), m.type === "virement_interne" ? "—" : m.journal.nom, LIBELLE_TYPE[m.type], libelle(m), fmtMontant(m.montant), pointage(m)] };
}

export async function pdfMouvements(
  mouvements: MouvementListe[],
  filtre: { compte: string | null; exercice: string | null },
  association: string,
  edite: Date = new Date(),
): Promise<DocumentPdf> {
  const doc = await DocumentPdf.creer({
    association,
    titre: "Mouvements",
    sousTitre: `${filtre.exercice ? `Exercice ${filtre.exercice}` : "Tous les exercices"} — ${filtre.compte ? `compte ${filtre.compte}` : "tous les comptes"}`,
    edite,
  });

  // Les virements entre comptes ne comptent ni en recette ni en dépense.
  const total = (type: "recette" | "depense") => Math.round(mouvements.filter((m) => m.type === type).reduce((s, m) => s + m.montant, 0) * 100) / 100;
  const recettes = total("recette");
  const depenses = total("depense");

  doc.tableau(COLONNES_MOUVEMENTS, [
    ...(mouvements.length === 0 ? [{ cellules: ["", "", "", "Aucun mouvement.", "", ""] }] : mouvements.map(ligneMouvement)),
    ...(mouvements.length === 0
      ? []
      : [
          { cellules: ["", "", "", `Total recettes (${mouvements.length} mouvements)`, fmtMontant(recettes), ""], style: "categorie" as const },
          { cellules: ["", "", "", "Total dépenses", fmtMontant(depenses), ""], style: "categorie" as const },
          { cellules: ["", "", "", "Solde (recettes − dépenses)", fmtMontant(Math.round((recettes - depenses) * 100) / 100), ""], style: "total" as const },
        ]),
  ]);
  return doc;
}

export type RapprochementListe = { date: Date; solde: number; valideLe: Date; nombreMouvements: number };

export async function pdfRapprochement(
  donnees: {
    compte: string;
    base: { date: Date | null; solde: number };
    releve: { date: Date; solde: number; ecart: number } | null;
    nonRapproches: MouvementListe[];
    historique: RapprochementListe[];
    detail: { rapprochement: RapprochementListe; mouvements: MouvementListe[] } | null;
  },
  association: string,
  edite: Date = new Date(),
): Promise<DocumentPdf> {
  const { compte, base, releve, nonRapproches, historique, detail } = donnees;
  const doc = await DocumentPdf.creer({ association, titre: `Rapprochement bancaire — ${compte}`, sousTitre: `Situation au ${fmtDate(edite)}`, edite });

  doc.sousTitre("Point de départ");
  doc.tableau(
    [{ titre: "", poids: 4 }, { titre: "Montant", poids: 1.6, alignement: "droite" }],
    [
      { cellules: [base.date ? `Solde du dernier rapprochement (${fmtDate(base.date)})` : "Solde d'ouverture du compte (aucun rapprochement validé)", fmtMontant(base.solde)] },
      ...(releve
        ? [
            { cellules: [`Solde du relevé (${fmtDate(releve.date)})`, fmtMontant(releve.solde)] },
            { cellules: [releve.ecart === 0 ? "Écart : nul — rapprochement possible" : "Écart restant à pointer", fmtMontant(releve.ecart)], style: "total" as const },
          ]
        : []),
    ],
  );

  doc.sousTitre(releve ? `Mouvements non rapprochés jusqu'au ${fmtDate(releve.date)}` : "Mouvements non rapprochés");
  doc.tableau(
    COLONNES_MOUVEMENTS,
    nonRapproches.length === 0 ? [{ cellules: ["", "", "", "Aucun mouvement en attente de rapprochement.", "", ""] }] : nonRapproches.map(ligneMouvement),
  );

  doc.sousTitre("Rapprochements effectués");
  doc.tableau(
    [
      { titre: "Date du relevé", poids: 2 },
      { titre: "Solde", poids: 1.6, alignement: "droite" },
      { titre: "Mouvements", poids: 1.4, alignement: "droite" },
      { titre: "Validé le", poids: 2 },
    ],
    historique.length === 0
      ? [{ cellules: ["Aucun rapprochement validé.", "", "", ""] }]
      : historique.map((h): LigneTableau => ({ cellules: [fmtDate(h.date), fmtMontant(h.solde), String(h.nombreMouvements), fmtDate(h.valideLe)] })),
  );

  if (detail) {
    doc.sousTitre(`Détail du rapprochement du ${fmtDate(detail.rapprochement.date)} (solde ${fmtMontant(detail.rapprochement.solde)})`);
    doc.tableau(COLONNES_MOUVEMENTS, detail.mouvements.map(ligneMouvement));
  }
  return doc;
}
