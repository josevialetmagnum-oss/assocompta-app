import { prisma } from "@/lib/prisma";
import { associationCourante } from "@/lib/association";
import { exerciceActif, resultatParCategorie, situationTresorerie, soldesJournaux } from "@/lib/tresorerie";
import { pdfSoldesEtResultats } from "@/lib/pdf-etats";
import { reponsePdf } from "@/lib/reponse-pdf";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const associationId = await associationCourante();
  const demande = new URL(request.url).searchParams.get("exercice");
  const [association, actif] = await Promise.all([
    prisma.association.findUniqueOrThrow({ where: { id: associationId } }),
    exerciceActif(associationId),
  ]);

  const exerciceId = demande ? Number(demande) : actif?.id;
  // Le filtre sur l'association garantit qu'on ne lit jamais l'exercice d'une autre.
  const exercice = exerciceId ? await prisma.exercice.findFirst({ where: { id: exerciceId, associationId } }) : null;
  if (!exercice) return new Response("Exercice introuvable.", { status: 404 });

  const [soldes, lignes, situation] = await Promise.all([
    soldesJournaux(associationId),
    resultatParCategorie(associationId, exercice.id),
    situationTresorerie(associationId, exercice.id),
  ]);
  const doc = await pdfSoldesEtResultats({ exercice, soldes, lignes, situation }, association.nom);
  return reponsePdf(await doc.octets(), "soldes-et-resultats", exercice.libelle, association.nom);
}
