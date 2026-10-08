import { revalidatePath } from "next/cache";
import { associationCourante, exigerEcriture } from "@/lib/association";
import { importerSauvegarde, TAILLE_MAX_SAUVEGARDE } from "@/lib/import-sauvegarde";
import { origineAutorisee } from "@/lib/url-publique";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const reponse = (corps: object, status = 200) =>
  Response.json(corps, { status, headers: { "Cache-Control": "private, no-store" } });

// POST multipart : `fichier` (la sauvegarde JSON) et `confirmer` ("1" pour importer vraiment ; sinon
// simple vérification qui renvoie le résumé). Réservé à l'association de la session, en écriture.
export async function POST(request: Request) {
  // Défense en plus du cookie SameSite : une requête venue d'un autre site est refusée.
  const origine = request.headers.get("origin");
  if (origine && !origineAutorisee(origine, request.url)) {
    return reponse({ ok: false, erreurs: ["Requête refusée (origine inattendue)."] }, 403);
  }

  const associationId = await associationCourante();
  try {
    await exigerEcriture();
  } catch {
    return reponse({ ok: false, erreurs: ["Ce compte est en lecture seule : il ne peut pas importer de données."] }, 403);
  }

  const formulaire = await request.formData().catch(() => null);
  const fichier = formulaire?.get("fichier");
  if (!(fichier instanceof File)) return reponse({ ok: false, erreurs: ["Aucun fichier reçu."] }, 400);
  if (fichier.size > TAILLE_MAX_SAUVEGARDE) {
    return reponse({ ok: false, erreurs: [`Fichier trop volumineux (${Math.round(TAILLE_MAX_SAUVEGARDE / 1024 / 1024)} Mo au plus).`] }, 413);
  }
  const confirmer = formulaire?.get("confirmer") === "1";

  try {
    const res = await importerSauvegarde(associationId, await fichier.text(), confirmer);
    if (res.ok && confirmer) {
      for (const chemin of ["/", "/mouvements", "/rapprochement", "/etats", "/parametrage"]) revalidatePath(chemin);
    }
    return reponse({ ...res, applique: res.ok && confirmer }, res.ok ? 200 : 422);
  } catch (e) {
    console.error("Import de sauvegarde échoué", e);
    return reponse({ ok: false, erreurs: ["L'import a échoué ; rien n'a été modifié. Réessayez, ou contactez le support si cela se reproduit."] }, 500);
  }
}
