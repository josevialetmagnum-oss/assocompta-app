// Export des données d'UNE association (la sienne : l'appelant fournit l'associationId de la session).
//  - JSON : sauvegarde complète et lisible (association, comptes, exercices, journaux, catégories,
//    mouvements avec leur ventilation, rapprochements). Aucun mot de passe ni jeton n'y figure jamais :
//    pour les comptes, seulement l'email, le rôle et l'état.
//  - CSV : les mouvements, une ligne par ventilation, prêts pour Excel (séparateur « ; », virgule
//    décimale, BOM UTF-8) pour qu'un trésorier ou un expert-comptable les reprenne.

import { prisma } from "@/lib/prisma";

const LIBELLE_TYPE = { recette: "Recette", depense: "Dépense", virement_interne: "Virement interne" } as const;
const LIBELLE_TRANSACTION: Record<string, string> = {
  virement: "Virement", prelevement: "Prélèvement", cheque: "Chèque", especes: "Espèces", autre: "Autre",
};
const jour = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export async function exporterAssociation(associationId: number) {
  const association = await prisma.association.findUniqueOrThrow({ where: { id: associationId } });
  const [utilisateurs, exercices, journaux, categories, rapprochements, mouvements] = await Promise.all([
    prisma.utilisateur.findMany({ where: { associationId }, select: { email: true, role: true, actif: true, createdAt: true }, orderBy: { id: "asc" } }),
    prisma.exercice.findMany({ where: { associationId }, include: { soldesCloture: { include: { journal: true }, orderBy: { journal: { nom: "asc" } } } }, orderBy: { dateDebut: "asc" } }),
    prisma.journal.findMany({ where: { associationId }, orderBy: { nom: "asc" } }),
    prisma.categorie.findMany({ where: { associationId }, include: { sousCategories: { orderBy: { nom: "asc" } } }, orderBy: [{ type: "asc" }, { nom: "asc" }] }),
    prisma.rapprochement.findMany({ where: { associationId }, include: { journal: true, mouvements: { select: { id: true }, orderBy: { id: "asc" } } }, orderBy: [{ date: "asc" }, { id: "asc" }] }),
    prisma.mouvement.findMany({
      where: { associationId },
      include: {
        exercice: true, journal: true, journalDestination: true,
        ventilations: { include: { sousCategorie: { include: { categorie: true } } }, orderBy: { id: "asc" } },
      },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
  ]);

  return {
    format: "assocompta-export",
    version: 1,
    exporteLe: new Date().toISOString(),
    association: { nom: association.nom, active: association.actif, creeLe: association.createdAt.toISOString() },
    comptes: utilisateurs.map((u) => ({ email: u.email, role: u.role, actif: u.actif, creeLe: u.createdAt.toISOString() })),
    journaux: journaux.map((j) => ({ nom: j.nom, actif: j.actif, soldeInitial: j.soldeInitial })),
    categories: categories.map((c) => ({
      nom: c.nom, type: c.type, actif: c.actif,
      sousCategories: c.sousCategories.map((sc) => ({ nom: sc.nom, actif: sc.actif })),
    })),
    exercices: exercices.map((e) => ({
      libelle: e.libelle, dateDebut: jour(e.dateDebut), dateFin: jour(e.dateFin), cloture: e.cloture, clotureLe: e.clotureLe?.toISOString() ?? null,
      soldesCloture: e.soldesCloture.map((s) => ({ compte: s.journal.nom, solde: s.solde })),
    })),
    rapprochements: rapprochements.map((r) => ({
      id: r.id, compte: r.journal.nom, date: jour(r.date), solde: r.solde, valideLe: r.createdAt.toISOString(),
      mouvements: r.mouvements.map((m) => m.id),
    })),
    mouvements: mouvements.map((m) => ({
      id: m.id, exercice: m.exercice.libelle, date: jour(m.date), dateBilan: jour(m.dateBilan), type: m.type, montant: m.montant,
      compte: m.journal.nom, compteDestination: m.journalDestination?.nom ?? null,
      typeTransaction: m.typeTransaction, tiers: m.tiers, numeroCheque: m.numeroCheque, numeroFacture: m.numeroFacture, commentaire: m.commentaire,
      pointe: m.pointe, pointeLe: m.pointeLe?.toISOString() ?? null, rapprochementId: m.rapprochementId,
      ventilations: m.ventilations.map((v) => ({ categorie: v.sousCategorie.categorie.nom, sousCategorie: v.sousCategorie.nom, montant: v.montant })),
    })),
  };
}

// Une cellule texte : entre guillemets si elle contient « ; », un guillemet ou un saut de ligne, et
// neutralisée si elle commencerait par un caractère que Excel interpréterait comme une formule
// (= + - @ ou tabulation / retour chariot) : un « Tiers » saisi « =HYPERLINK(...) » ne doit jamais
// s'exécuter chez celui qui ouvre l'export.
export function celluleCsv(valeur: string | null | undefined): string {
  let texte = valeur ?? "";
  if (/^[=+\-@\t\r]/.test(texte)) texte = `'${texte}`;
  return /[;"\n\r]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
}

// Montant au format français sans séparateur de milliers (« 1234,50 »), directement numérique dans Excel.
export const montantCsv = (n: number) => n.toFixed(2).replace(".", ",");

const COLONNES = [
  "N° mouvement", "Date", "Date bilan", "Exercice", "Type", "Compte", "Compte destination", "Catégorie", "Sous-catégorie",
  "Montant", "Tiers", "Type de transaction", "N° chèque", "N° facture", "Commentaire", "Pointé", "Rapprochement du",
] as const;

export async function exporterMouvementsCsv(associationId: number): Promise<string> {
  const mouvements = await prisma.mouvement.findMany({
    where: { associationId },
    include: {
      exercice: true, journal: true, journalDestination: true, rapprochement: true,
      ventilations: { include: { sousCategorie: { include: { categorie: true } } }, orderBy: { id: "asc" } },
    },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });

  const lignes: string[] = [COLONNES.map(celluleCsv).join(";")];
  for (const m of mouvements) {
    const commun = (categorie: string, sousCategorie: string, montant: number) =>
      [
        String(m.id), jour(m.date)!, jour(m.dateBilan)!, m.exercice.libelle, LIBELLE_TYPE[m.type], m.journal.nom, m.journalDestination?.nom ?? "",
        categorie, sousCategorie, montantCsv(montant), m.tiers ?? "", LIBELLE_TRANSACTION[m.typeTransaction] ?? m.typeTransaction,
        m.numeroCheque ?? "", m.numeroFacture ?? "", m.commentaire ?? "", m.pointe ? "Oui" : "Non", jour(m.rapprochement?.date ?? null) ?? "",
      ].map(celluleCsv).join(";");

    if (m.ventilations.length === 0) lignes.push(commun("", "", m.montant));
    else for (const v of m.ventilations) lignes.push(commun(v.sousCategorie.categorie.nom, v.sousCategorie.nom, v.montant));
  }
  // BOM + CRLF : Excel (français) reconnaît ainsi l'UTF-8 et les lignes.
  return `﻿${lignes.join("\r\n")}\r\n`;
}
