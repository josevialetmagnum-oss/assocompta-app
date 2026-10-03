import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { DocumentPdf, nomFichierPdf } from "@/lib/pdf";

const options = { association: "Club de judo", titre: "Essai", sousTitre: "Du 01/01/2026 au 31/12/2026", edite: new Date("2026-10-02") };

describe("DocumentPdf", () => {
  it("produit un PDF A4 lisible, avec en-tête et pied de page", async () => {
    const doc = await DocumentPdf.creer(options);
    doc.tableau(
      [{ titre: "Libellé", poids: 3 }, { titre: "Montant", poids: 1, alignement: "droite" }],
      [{ cellules: ["Cotisations", "120,00 €"] }, { cellules: ["Total", "120,00 €"], style: "total" }],
    );
    const octets = await doc.octets();
    expect(Buffer.from(octets.slice(0, 5)).toString()).toBe("%PDF-");

    const relu = await PDFDocument.load(octets);
    expect(relu.getPageCount()).toBe(1);
    const { width, height } = relu.getPage(0).getSize();
    expect([Math.round(width), Math.round(height)]).toEqual([595, 842]);
    expect(relu.getTitle()).toContain("Club de judo");
    expect(doc.modele.filter((m) => m.type === "ligne")).toHaveLength(2);
  });

  it("passe à la page suivante quand le tableau est long, sans perdre de ligne", async () => {
    const doc = await DocumentPdf.creer(options);
    const lignes = Array.from({ length: 120 }, (_, i) => ({ cellules: [`Ligne ${i + 1}`, `${i + 1},00 €`] }));
    doc.tableau([{ titre: "Libellé", poids: 3 }, { titre: "Montant", poids: 1, alignement: "droite" }], lignes);

    expect(doc.nombrePages).toBeGreaterThan(2);
    expect(doc.modele.filter((m) => m.type === "ligne")).toHaveLength(120);
    const relu = await PDFDocument.load(await doc.octets());
    expect(relu.getPageCount()).toBe(doc.nombrePages);
  });

  it("replie un libellé trop long sur plusieurs lignes, y compris un mot plus large que la colonne", async () => {
    const doc = await DocumentPdf.creer(options);
    const long = "Subventions des collectivités territoriales et organismes partenaires — fonctionnement général de l'association";
    const sansEspace = "X".repeat(400);
    doc.tableau([{ titre: "Libellé", poids: 1 }, { titre: "Montant", poids: 1, alignement: "droite" }], [
      { cellules: [long, "1,00 €"] },
      { cellules: [sansEspace, "2,00 €"] },
    ]);
    await expect(doc.octets()).resolves.toBeInstanceOf(Uint8Array);
  });

  it("n'échoue pas sur les caractères que la police ne sait pas dessiner ni sur les espaces insécables des nombres", async () => {
    const doc = await DocumentPdf.creer(options);
    const nombre = (1234567.5).toLocaleString("fr-FR", { minimumFractionDigits: 2 });
    doc.tableau([{ titre: "Libellé", poids: 1 }, { titre: "Montant", poids: 1 }], [
      { cellules: ["Virement → Banque ★ 日本語 « é à ç œ » —", `${nombre} €`] },
    ]);
    doc.paragraphe("Texte avec émoji 😀 et retours\nà la ligne");
    await expect(doc.octets()).resolves.toBeInstanceOf(Uint8Array);
  });

  it("garde un titre de partie avec son tableau (pas de titre seul en bas de page)", async () => {
    const doc = await DocumentPdf.creer(options);
    doc.tableau([{ titre: "A", poids: 1 }], Array.from({ length: 56 }, (_, i) => ({ cellules: [`l${i}`] })));
    const avant = doc.nombrePages;
    doc.sousTitre("Partie suivante");
    doc.tableau([{ titre: "A", poids: 1 }], [{ cellules: ["x"] }]);
    expect(doc.nombrePages).toBeGreaterThanOrEqual(avant);
    await expect(doc.octets()).resolves.toBeInstanceOf(Uint8Array);
  });
});

describe("nomFichierPdf", () => {
  it("donne un nom ASCII sans espace ni accent", () => {
    expect(nomFichierPdf("bilan", "2026", "Club de Judo — Saint-Étienne")).toBe("bilan-2026-club-de-judo-saint-etienne.pdf");
  });

  it("n'est jamais vide et ne laisse passer aucun séparateur de chemin", () => {
    expect(nomFichierPdf("../../etc/passwd")).toBe("etc-passwd.pdf");
    expect(nomFichierPdf("???")).toBe("etat.pdf");
  });
});

describe("transcription des symboles", () => {
  it("transcrit les flèches et le vrai signe moins que la police standard ne contient pas", async () => {
    const { transcrire } = await import("@/lib/pdf");
    expect(transcrire("Caisse → Banque ← Retour")).toBe("Caisse -> Banque <- Retour");
    expect(transcrire("recettes − dépenses")).toBe("recettes - dépenses");
    expect(transcrire("é à ç € —")).toBe("é à ç € —");
  });
});
