// Manuel d'utilisation intégré à l'application (page /manuel). Le contenu vient de src/content/manuel.json, produit à
// partir du manuel rédigé dans le document de référence ; ce fichier-ci n'en contient que les types et des fonctions
// pures (sommaire, ancres), testables sans rendu.

import donnees from "@/content/manuel.json";

export type Morceau = { t: string; b?: boolean; c?: boolean };
export type ElementListe = { texte: Morceau[]; sous: BlocListe[] };
export type BlocListe = { type: "liste"; ordonnee: boolean; elements: ElementListe[] };
export type BlocTitre = { type: "titre"; niveau: 1 | 2 | 3 | 4; texte: string };
export type BlocParagraphe = { type: "paragraphe"; texte: Morceau[] };
export type BlocTableau = { type: "tableau"; entete: Morceau[][]; lignes: Morceau[][][] };
export type Bloc = BlocTitre | BlocParagraphe | BlocListe | BlocTableau;

export const MANUEL = donnees as unknown as Bloc[];

// Ancre d'un titre : minuscules sans accents, tirets entre les mots.
export function ancre(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Une ancre par titre (niveau 2 à 4), unique dans la page : un titre répété reçoit -2, -3…
export function ancresDesTitres(blocs: Bloc[]): Map<BlocTitre, string> {
  const vues = new Map<string, number>();
  const resultat = new Map<BlocTitre, string>();
  for (const b of blocs) {
    if (b.type !== "titre" || b.niveau === 1) continue;
    const base = ancre(b.texte) || "section";
    const n = (vues.get(base) ?? 0) + 1;
    vues.set(base, n);
    resultat.set(b, n === 1 ? base : `${base}-${n}`);
  }
  return resultat;
}

export type EntreeSommaire = { titre: string; ancre: string; sousTitres: { titre: string; ancre: string }[] };

// Sommaire : les titres de niveau 2, chacun avec ses titres de niveau 3 (le niveau 4 reste dans le texte).
export function sommaire(blocs: Bloc[]): EntreeSommaire[] {
  const ancres = ancresDesTitres(blocs);
  const entrees: EntreeSommaire[] = [];
  for (const b of blocs) {
    if (b.type !== "titre" || b.niveau === 1) continue;
    const a = ancres.get(b)!;
    if (b.niveau === 2) entrees.push({ titre: b.texte, ancre: a, sousTitres: [] });
    else if (b.niveau === 3) entrees[entrees.length - 1]?.sousTitres.push({ titre: b.texte, ancre: a });
  }
  return entrees;
}

export function texteBrut(morceaux: Morceau[]): string {
  return morceaux.map((m) => m.t).join("");
}

// Tout le texte du manuel (pour les contrôles de cohérence).
export function texteDuManuel(blocs: Bloc[]): string {
  const parties: string[] = [];
  const liste = (l: BlocListe) => l.elements.forEach((e) => { parties.push(texteBrut(e.texte)); e.sous.forEach(liste); });
  for (const b of blocs) {
    if (b.type === "titre") parties.push(b.texte);
    else if (b.type === "paragraphe") parties.push(texteBrut(b.texte));
    else if (b.type === "liste") liste(b);
    else {
      b.entete.forEach((c) => parties.push(texteBrut(c)));
      b.lignes.forEach((l) => l.forEach((c) => parties.push(texteBrut(c))));
    }
  }
  return parties.join("\n");
}
