import { prisma } from "@/lib/prisma";
import { associationCourante } from "@/lib/association";
import { exerciceActif } from "@/lib/tresorerie";
import { bilanExercice } from "@/lib/bilan";
import { pdfBilan } from "@/lib/pdf-etats";
import { reponsePdf } from "@/lib/reponse-pdf";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const associationId = await associationCourante();
  const demande = new URL(request.url).searchParams.get("exercice");
  const [association, actif] = await Promise.all([
    prisma.association.findUniqueOrThrow({ where: { id: associationId } }),
    exerciceActif(associationId),
  ]);

  // Même règle que la page : l'exercice demandé, sinon l'exercice en cours.
  const exerciceId = demande ? Number(demande) : actif?.id;
  const bilan = exerciceId ? await bilanExercice(associationId, exerciceId) : null;
  if (!bilan) return new Response("Exercice introuvable.", { status: 404 });

  const doc = await pdfBilan(bilan, association.nom);
  return reponsePdf(await doc.octets(), "bilan", bilan.exercice.libelle, association.nom);
}
