import { nomFichierPdf } from "@/lib/pdf";

// Réponse HTTP d'un PDF à télécharger. `no-store` : un état change dès qu'un mouvement est saisi, et
// il est propre à l'association connectée (jamais mis en cache partagé).
export function reponsePdf(octets: Uint8Array, ...nom: string[]): Response {
  return new Response(octets as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomFichierPdf(...nom)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
