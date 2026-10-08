// Adresse publique de l'application, pour les redirections du middleware et le contrôle d'origine des envois.
//
// Derrière un frontal (Caddy sur le VPS), `request.url` reflète l'adresse d'écoute du serveur Node
// (https://localhost:3002), pas celle que le visiteur a tapée : une redirection construite dessus l'enverrait
// vers « localhost ». En production, SITE_URL (voir .env) est donc la source de vérité ; sans elle (Vercel,
// où `request.url` est exact) comme hors production (serveurs de développement sur des ports variables),
// on garde l'adresse de la requête.
export function baseUrlPublique(urlRequete: string, env: Record<string, string | undefined> = process.env): string {
  const configuree = env.SITE_URL?.trim();
  if (configuree && env.NODE_ENV === "production") return configuree.replace(/\/+$/, "");
  return new URL(urlRequete).origin;
}

/** URL absolue d'un chemin de l'application (ex. "/connexion"), sur l'adresse publique. */
export function urlPublique(chemin: string, urlRequete: string, env: Record<string, string | undefined> = process.env): URL {
  return new URL(chemin, `${baseUrlPublique(urlRequete, env)}/`);
}

/** Vrai si l'en-tête Origin d'une requête désigne l'application elle-même (défense contre les envois d'un autre site). */
export function origineAutorisee(origine: string, urlRequete: string, env: Record<string, string | undefined> = process.env): boolean {
  try {
    return new URL(origine).host === new URL(baseUrlPublique(urlRequete, env)).host;
  } catch {
    return false;
  }
}
