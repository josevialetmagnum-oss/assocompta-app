// Nom de fichier sûr (ASCII, sans espaces ni séparateur de chemin) :
// « Bilan 2026 — Club de judo » + « pdf » → « bilan-2026-club-de-judo.pdf ».
export function nomFichier(extension: string, ...morceaux: string[]): string {
  const propre = morceaux
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${propre || "export"}.${extension}`;
}
