// Petit moteur de PDF A4 pour les états (tableaux à colonnes, sauts de page, en-tête, pied de page),
// construit directement à partir des données avec pdf-lib : pas de navigateur, pas de session à
// transmettre, donc rien d'autre que ce que l'appelant lui donne ne peut se retrouver dans le PDF.
//
// Polices standard (Helvetica) : elles couvrent le français, le « € » et le tiret long ; tout autre
// caractère est remplacé par « ? » (voir `sur`) plutôt que de faire échouer l'export.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type Alignement = "gauche" | "droite";
export type Colonne = { titre: string; poids: number; alignement?: Alignement };
export type StyleLigne = "normal" | "categorie" | "sous" | "total" | "section";
export type LigneTableau = { cellules: string[]; style?: StyleLigne };

// Ce qui a été posé dans le document, dans l'ordre : sert aux tests (le texte d'un PDF n'est pas
// relisible simplement) et ne dépend pas de la mise en page.
export type ElementModele =
  | { type: "texte"; texte: string }
  | { type: "entete"; cellules: string[] }
  | { type: "ligne"; style: StyleLigne; cellules: string[] };

const LARGEUR = 595.28;
const HAUTEUR = 841.89;
const MARGE = 40;
const MARGE_BAS = 50;
const TAILLE = 9;
const INTERLIGNE = 12;
const NOIR = rgb(0.1, 0.14, 0.12);
const GRIS = rgb(0.36, 0.42, 0.38);
const VERT_FOND = rgb(0.93, 0.95, 0.92);
const TRAIT = rgb(0.75, 0.78, 0.74);

export type OptionsDocument = { association: string; titre: string; sousTitre?: string; edite: Date };

export class DocumentPdf {
  readonly modele: ElementModele[] = [];
  private constructor(
    private readonly doc: PDFDocument,
    private readonly police: PDFFont,
    private readonly gras: PDFFont,
    private readonly options: OptionsDocument,
  ) {
    this.nouvellePage();
    this.enTete();
  }

  private pages: PDFPage[] = [];
  private page!: PDFPage;
  private y = 0;
  private cacheCaracteres = new Map<string, boolean>();

  static async creer(options: OptionsDocument): Promise<DocumentPdf> {
    const doc = await PDFDocument.create();
    doc.setTitle(`${options.titre} — ${options.association}`);
    doc.setCreator("AssoCompta (LBSOFT)");
    doc.setProducer("AssoCompta (LBSOFT)");
    doc.setCreationDate(options.edite);
    const police = await doc.embedFont(StandardFonts.Helvetica);
    const gras = await doc.embedFont(StandardFonts.HelveticaBold);
    return new DocumentPdf(doc, police, gras, options);
  }

  // Remplace les espaces insécables (formats de nombres français) et tout caractère que la police
  // ne sait pas dessiner.
  private sur(texte: string, police: PDFFont = this.police): string {
    let sortie = "";
    for (const c of texte.replace(/[  ]/g, " ").replace(/[\r\n\t]+/g, " ")) {
      const cle = `${police === this.gras ? "g" : "n"}${c}`;
      let ok = this.cacheCaracteres.get(cle);
      if (ok === undefined) {
        try {
          police.encodeText(c);
          ok = true;
        } catch {
          ok = false;
        }
        this.cacheCaracteres.set(cle, ok);
      }
      sortie += ok ? c : "?";
    }
    return sortie;
  }

  private nouvellePage() {
    this.page = this.doc.addPage([LARGEUR, HAUTEUR]);
    this.pages.push(this.page);
    this.y = HAUTEUR - MARGE;
  }

  private enTete() {
    const { association, titre, sousTitre } = this.options;
    this.ecrire(association, MARGE, 9, this.police, GRIS);
    this.y -= 18;
    this.ecrire(titre, MARGE, 17, this.gras, NOIR);
    this.y -= 8;
    this.modele.push({ type: "texte", texte: association }, { type: "texte", texte: titre });
    if (sousTitre) {
      this.y -= 12;
      this.ecrire(sousTitre, MARGE, 10, this.police, GRIS);
      this.modele.push({ type: "texte", texte: sousTitre });
    }
    this.y -= 14;
  }

  private ecrire(texte: string, x: number, taille: number, police: PDFFont, couleur = NOIR) {
    this.page.drawText(this.sur(texte, police), { x, y: this.y, size: taille, font: police, color: couleur });
  }

  espace(hauteur: number) {
    this.y -= hauteur;
  }

  // Un titre de partie : garde au moins la place de quelques lignes pour ne pas finir seul en bas de page.
  sousTitre(texte: string) {
    this.garantirPlace(60);
    this.y -= 14;
    this.ecrire(texte, MARGE, 12, this.gras, NOIR);
    this.y -= 14;
    this.modele.push({ type: "texte", texte });
  }

  paragraphe(texte: string, options: { gras?: boolean; couleur?: ReturnType<typeof rgb> } = {}) {
    const police = options.gras ? this.gras : this.police;
    for (const ligne of this.decouper(texte, LARGEUR - 2 * MARGE, police, TAILLE)) {
      this.garantirPlace(INTERLIGNE);
      this.y -= INTERLIGNE - 2;
      this.ecrire(ligne, MARGE, TAILLE, police, options.couleur ?? NOIR);
      this.y -= 2;
    }
    this.modele.push({ type: "texte", texte });
  }

  private garantirPlace(hauteur: number): boolean {
    if (this.y - hauteur < MARGE_BAS) {
      this.nouvellePage();
      return true;
    }
    return false;
  }

  private decouper(texte: string, largeur: number, police: PDFFont, taille: number): string[] {
    const mots = this.sur(texte, police).split(" ");
    const lignes: string[] = [];
    let courante = "";
    for (const mot of mots) {
      const essai = courante ? `${courante} ${mot}` : mot;
      if (police.widthOfTextAtSize(essai, taille) <= largeur || !courante) {
        courante = essai;
      } else {
        lignes.push(courante);
        courante = mot;
      }
    }
    lignes.push(courante);
    // Un mot plus long que la colonne : on le coupe au caractère près.
    return lignes.flatMap((l) => {
      if (police.widthOfTextAtSize(l, taille) <= largeur) return [l];
      const morceaux: string[] = [];
      let m = "";
      for (const c of l) {
        if (police.widthOfTextAtSize(m + c, taille) > largeur && m) {
          morceaux.push(m);
          m = c;
        } else m += c;
      }
      morceaux.push(m);
      return morceaux;
    });
  }

  tableau(colonnes: Colonne[], lignes: LigneTableau[]) {
    const totalPoids = colonnes.reduce((s, c) => s + c.poids, 0);
    const largeurs = colonnes.map((c) => ((LARGEUR - 2 * MARGE) * c.poids) / totalPoids);
    const xs = largeurs.map((_, i) => MARGE + largeurs.slice(0, i).reduce((s, l) => s + l, 0));
    const marge = 6;

    const dessinerEntete = () => {
      this.y -= INTERLIGNE;
      colonnes.forEach((c, i) => this.ecrireCellule(c.titre, xs[i], largeurs[i], c.alignement, this.gras, TAILLE - 1, GRIS, marge));
      this.y -= 4;
      this.page.drawLine({ start: { x: MARGE, y: this.y }, end: { x: LARGEUR - MARGE, y: this.y }, thickness: 0.8, color: TRAIT });
    };
    this.garantirPlace(INTERLIGNE * 4);
    dessinerEntete();
    this.modele.push({ type: "entete", cellules: colonnes.map((c) => c.titre) });

    for (const ligne of lignes) {
      const style = ligne.style ?? "normal";
      const police = style === "categorie" || style === "total" || style === "section" ? this.gras : this.police;
      const retrait = style === "sous" ? 14 : 0;
      const section = style === "section";

      // Hauteur de la ligne = celle de sa cellule la plus haute (texte replié sur plusieurs lignes).
      const morceaux = section
        ? [this.decouper(ligne.cellules[0] ?? "", LARGEUR - 2 * MARGE - 2 * marge, police, TAILLE)]
        : ligne.cellules.map((cellule, i) => this.decouper(cellule, largeurs[i] - 2 * marge - (i === 0 ? retrait : 0), police, TAILLE));
      const nbLignes = Math.max(1, ...morceaux.map((m) => m.length));
      const hauteur = nbLignes * INTERLIGNE + 6;

      if (this.garantirPlace(hauteur)) dessinerEntete();

      const haut = this.y;
      if (section) this.page.drawRectangle({ x: MARGE, y: haut - hauteur + 2, width: LARGEUR - 2 * MARGE, height: hauteur - 2, color: VERT_FOND });
      if (style === "total") this.page.drawLine({ start: { x: MARGE, y: haut }, end: { x: LARGEUR - MARGE, y: haut }, thickness: 0.8, color: NOIR });

      morceaux.forEach((m, i) => {
        m.forEach((texte, k) => {
          this.y = haut - 3 - INTERLIGNE * (k + 1) + 3;
          const x = section ? MARGE : xs[i];
          const larg = section ? LARGEUR - 2 * MARGE : largeurs[i];
          this.ecrireCellule(texte, x + (i === 0 ? retrait : 0), larg - (i === 0 ? retrait : 0), section ? "gauche" : colonnes[i].alignement, police, TAILLE, NOIR, marge);
        });
      });
      this.y = haut - hauteur;
      if (style !== "section") {
        this.page.drawLine({ start: { x: MARGE, y: this.y + 1 }, end: { x: LARGEUR - MARGE, y: this.y + 1 }, thickness: 0.3, color: TRAIT });
      }
      this.modele.push({ type: "ligne", style, cellules: ligne.cellules });
    }
    this.y -= 6;
  }

  private ecrireCellule(
    texte: string, x: number, largeur: number, alignement: Alignement | undefined,
    police: PDFFont, taille: number, couleur: ReturnType<typeof rgb>, marge: number,
  ) {
    const propre = this.sur(texte, police);
    const w = police.widthOfTextAtSize(propre, taille);
    const posX = alignement === "droite" ? x + largeur - marge - w : x + marge;
    this.page.drawText(propre, { x: posX, y: this.y, size: taille, font: police, color: couleur });
  }

  get nombrePages(): number {
    return this.pages.length;
  }

  async octets(): Promise<Uint8Array> {
    const total = this.pages.length;
    const edite = this.options.edite.toLocaleDateString("fr-FR");
    this.pages.forEach((p, i) => {
      p.drawLine({ start: { x: MARGE, y: 36 }, end: { x: LARGEUR - MARGE, y: 36 }, thickness: 0.4, color: TRAIT });
      p.drawText(this.sur(`AssoCompta — LBSOFT · ${this.options.association} · édité le ${edite}`), { x: MARGE, y: 24, size: 7.5, font: this.police, color: GRIS });
      const pied = `Page ${i + 1} / ${total}`;
      p.drawText(pied, { x: LARGEUR - MARGE - this.police.widthOfTextAtSize(pied, 7.5), y: 24, size: 7.5, font: this.police, color: GRIS });
    });
    return this.doc.save();
  }
}

// Nom de fichier sûr (ASCII, sans espaces) : « Bilan 2026 — Club de judo » → « bilan-2026-club-de-judo.pdf ».
export function nomFichierPdf(...morceaux: string[]): string {
  const propre = morceaux
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${propre || "etat"}.pdf`;
}
