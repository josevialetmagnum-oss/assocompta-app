// Chargement des données (cloisonné par association) et validation des paramètres pour les PDF de la
// liste des mouvements et du rapprochement. Les routes ne font que servir le résultat ; la logique est
// ici pour pouvoir être testée sur le document lui-même.

import { prisma } from "@/lib/prisma";
import { exerciceActif } from "@/lib/tresorerie";
import { lireFiltreMouvements, listerMouvementsFiltres } from "@/lib/liste-mouvements";
import {
  dernierRapprochement, ecartRapprochement, listerRapprochements, mouvementsDuRapprochement, mouvementsNonRapprochesJournal,
} from "@/lib/rapprochement";
import { pdfMouvements, pdfRapprochement } from "@/lib/pdf-listes";
import type { DocumentPdf } from "@/lib/pdf";

export type PreparationPdf = { ok: true; doc: DocumentPdf; nom: string[] } | { ok: false; status: number; message: string };

export async function preparerPdfMouvements(associationId: number, params: URLSearchParams): Promise<PreparationPdf> {
  const [association, actif] = await Promise.all([
    prisma.association.findUniqueOrThrow({ where: { id: associationId } }),
    exerciceActif(associationId),
  ]);

  // Mêmes règles que l'écran (lireFiltreMouvements) : exercice absent = en cours, vide = tous.
  const filtre = lireFiltreMouvements(
    { journal: params.get("journal") ?? undefined, exercice: params.get("exercice") ?? undefined },
    actif?.id,
  );

  // Le compte et l'exercice demandés doivent appartenir à l'association : sinon 404, jamais le nom d'un autre.
  const [journal, exercice] = await Promise.all([
    filtre.journalId ? prisma.journal.findFirst({ where: { id: filtre.journalId, associationId } }) : null,
    filtre.exerciceId ? prisma.exercice.findFirst({ where: { id: filtre.exerciceId, associationId } }) : null,
  ]);
  if ((filtre.journalId && !journal) || (filtre.exerciceId && !exercice)) {
    return { ok: false, status: 404, message: "Compte ou exercice introuvable." };
  }

  // Ordre chronologique pour un document imprimé (l'écran affiche le plus récent d'abord).
  const mouvements = await listerMouvementsFiltres(associationId, filtre, "asc");
  const doc = await pdfMouvements(mouvements, { compte: journal?.nom ?? null, exercice: exercice?.libelle ?? null }, association.nom);
  return { ok: true, doc, nom: ["mouvements", exercice?.libelle ?? "tous", journal?.nom ?? "", association.nom] };
}

export async function preparerPdfRapprochement(associationId: number, params: URLSearchParams): Promise<PreparationPdf> {
  const journaux = await prisma.journal.findMany({ where: { associationId, actif: true }, orderBy: { nom: "asc" } });
  if (journaux.length === 0) return { ok: false, status: 404, message: "Aucun compte." };

  // Même résolution que l'écran : le compte demandé, sinon le premier.
  const demande = params.get("journal") ? Number(params.get("journal")) : journaux[0].id;
  const journal = journaux.find((j) => j.id === demande);
  if (!journal) return { ok: false, status: 404, message: "Compte introuvable." };

  const dateReleve = new Date(params.get("date") || new Date().toISOString().slice(0, 10));
  if (Number.isNaN(dateReleve.getTime())) return { ok: false, status: 400, message: "Date invalide." };
  const soldeBrut = params.get("solde")?.trim();
  const soldeReleve = soldeBrut ? Number(soldeBrut) : null;
  if (soldeReleve !== null && !Number.isFinite(soldeReleve)) return { ok: false, status: 400, message: "Solde invalide." };

  const [association, dernier, historique, nonRapproches] = await Promise.all([
    prisma.association.findUniqueOrThrow({ where: { id: associationId } }),
    dernierRapprochement(associationId, journal.id),
    listerRapprochements(associationId, journal.id),
    mouvementsNonRapprochesJournal(associationId, journal.id, dateReleve),
  ]);
  const ecart = soldeReleve !== null ? await ecartRapprochement(associationId, journal.id, dateReleve, soldeReleve) : null;

  // Détail d'un rapprochement : uniquement un rapprochement de CE compte (donc de cette association).
  const detailId = params.get("detail") ? Number(params.get("detail")) : null;
  const rapprochement = detailId ? historique.find((h) => h.id === detailId) ?? null : null;
  const detail = rapprochement ? { rapprochement, mouvements: await mouvementsDuRapprochement(associationId, rapprochement.id) } : null;

  const doc = await pdfRapprochement(
    {
      compte: journal.nom,
      base: { date: dernier?.date ?? null, solde: dernier?.solde ?? journal.soldeInitial },
      releve: soldeReleve !== null && ecart !== null ? { date: dateReleve, solde: soldeReleve, ecart } : null,
      nonRapproches,
      historique,
      detail,
    },
    association.nom,
  );
  return { ok: true, doc, nom: ["rapprochement", journal.nom, association.nom] };
}
