import { prisma } from "@/lib/prisma";
import { associationCourante } from "@/lib/association";
import { exerciceActif } from "@/lib/tresorerie";
import { analyseParLignes } from "@/lib/analyse";
import { lireParametresAnalyse } from "@/lib/analyse-params";
import { pdfAnalyse } from "@/lib/pdf-etats";
import { reponsePdf } from "@/lib/reponse-pdf";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const associationId = await associationCourante();
  const params = new URL(request.url).searchParams;
  const [association, actif] = await Promise.all([
    prisma.association.findUniqueOrThrow({ where: { id: associationId } }),
    exerciceActif(associationId),
  ]);

  const { du, au, demandees, periodeInvalide } = lireParametresAnalyse(
    { du: params.get("du") ?? undefined, au: params.get("au") ?? undefined, rec: params.getAll("rec"), dep: params.getAll("dep") },
    actif,
  );
  if (periodeInvalide) return new Response("La date de fin doit être postérieure ou égale à la date de début.", { status: 400 });

  const resultat = await analyseParLignes(associationId, new Date(du), new Date(au), demandees);
  const doc = await pdfAnalyse(resultat, { du: new Date(du), au: new Date(au) }, association.nom);
  return reponsePdf(await doc.octets(), "analyse", du, au, association.nom);
}
