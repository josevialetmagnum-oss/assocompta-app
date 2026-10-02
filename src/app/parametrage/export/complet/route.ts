import { prisma } from "@/lib/prisma";
import { associationCourante } from "@/lib/association";
import { exporterAssociation } from "@/lib/export-donnees";
import { nomFichier } from "@/lib/nom-fichier";

export const dynamic = "force-dynamic";

// Lecture seule des données de l'association de la session (le superviseur, sans association, est
// renvoyé par associationCourante() : il n'a jamais accès aux données).
export async function GET() {
  const associationId = await associationCourante();
  const [association, donnees] = await Promise.all([
    prisma.association.findUniqueOrThrow({ where: { id: associationId } }),
    exporterAssociation(associationId),
  ]);
  return new Response(JSON.stringify(donnees, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomFichier("json", "sauvegarde", association.nom, new Date().toISOString().slice(0, 10))}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
