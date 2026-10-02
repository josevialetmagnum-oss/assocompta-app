// Noms de fichiers sûrs (ASCII, sans espaces ni séparateur de chemin) :
// « Bilan 2026 — Club de judo » → « bilan-2026-club-de-judo ».
export function slugFichier(...morceaux: string[]): string {
  return morceaux
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// `defaut` sert quand rien d'exploitable ne reste (que des symboles, par exemple).
export function nomFichier(extension: string, defaut: string, ...morceaux: string[]): string {
  return `${slugFichier(...morceaux) || defaut}.${extension}`;
}
