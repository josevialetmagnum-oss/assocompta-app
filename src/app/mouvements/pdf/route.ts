import { associationCourante } from "@/lib/association";
import { preparerPdfMouvements } from "@/lib/pdf-listes-donnees";
import { reponsePdf } from "@/lib/reponse-pdf";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const associationId = await associationCourante();
  const preparation = await preparerPdfMouvements(associationId, new URL(request.url).searchParams);
  if (!preparation.ok) return new Response(preparation.message, { status: preparation.status });
  return reponsePdf(await preparation.doc.octets(), ...preparation.nom);
}
