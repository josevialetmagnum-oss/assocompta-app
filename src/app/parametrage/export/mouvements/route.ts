import { prisma } from "@/lib/prisma";
import { associationCourante } from "@/lib/association";
import { exporterMouvementsCsv } from "@/lib/export-donnees";
import { nomFichier } from "@/lib/nom-fichier";

export const dynamic = "force-dynamic";

export async function GET() {
  const associationId = await associationCourante();
  const [association, csv] = await Promise.all([
    prisma.association.findUniqueOrThrow({ where: { id: associationId } }),
    exporterMouvementsCsv(associationId),
  ]);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomFichier("csv", "mouvements", association.nom, new Date().toISOString().slice(0, 10))}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
