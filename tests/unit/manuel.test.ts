import { describe, expect, it } from "vitest";
import { ancre, ancresDesTitres, MANUEL, sommaire, texteBrut, texteDuManuel, type Bloc } from "@/lib/manuel";
import { ENTREE_MANUEL, MENU_METIER } from "@/lib/navigation";

describe("ancres et sommaire", () => {
  it("ancre : minuscules, sans accents, tirets", () => {
    expect(ancre("Démarrer en 10 minutes")).toBe("demarrer-en-10-minutes");
    expect(ancre("« Impossible de retirer cette adhésion »")).toBe("impossible-de-retirer-cette-adhesion");
    expect(ancre("???")).toBe("");
  });

  it("un titre répété reçoit une ancre distincte", () => {
    const blocs: Bloc[] = [
      { type: "titre", niveau: 1, texte: "Manuel" },
      { type: "titre", niveau: 2, texte: "Paiements" },
      { type: "titre", niveau: 3, texte: "Relancer" },
      { type: "titre", niveau: 2, texte: "Messages" },
      { type: "titre", niveau: 3, texte: "Relancer" },
    ];
    expect([...ancresDesTitres(blocs).values()]).toEqual(["paiements", "relancer", "messages", "relancer-2"]);
    expect(sommaire(blocs)).toEqual([
      { titre: "Paiements", ancre: "paiements", sousTitres: [{ titre: "Relancer", ancre: "relancer" }] },
      { titre: "Messages", ancre: "messages", sousTitres: [{ titre: "Relancer", ancre: "relancer-2" }] },
    ]);
  });
});

describe("titres de niveau 4", () => {
  it("reçoivent une ancre mais restent hors du sommaire", () => {
    const blocs: Bloc[] = [
      { type: "titre", niveau: 2, texte: "Importer" },
      { type: "titre", niveau: 3, texte: "Importer une sauvegarde" },
      { type: "titre", niveau: 4, texte: "Les règles" },
    ];
    expect([...ancresDesTitres(blocs).values()]).toEqual(["importer", "importer-une-sauvegarde", "les-regles"]);
    expect(sommaire(blocs)).toEqual([{ titre: "Importer", ancre: "importer", sousTitres: [{ titre: "Importer une sauvegarde", ancre: "importer-une-sauvegarde" }] }]);
  });
});

describe("contenu du manuel embarqué", () => {
  it("a un titre, des sections et des ancres toutes uniques et non vides", () => {
    expect(MANUEL[0]).toMatchObject({ type: "titre", niveau: 1 });
    const s = sommaire(MANUEL);
    expect(s.length).toBeGreaterThanOrEqual(10);
    const toutes = [...ancresDesTitres(MANUEL).values()];
    expect(toutes.every((a) => a.length > 0)).toBe(true);
    expect(new Set(toutes).size).toBe(toutes.length);
  });

  it("aucun bloc vide, tableaux rectangulaires", () => {
    for (const b of MANUEL) {
      if (b.type === "titre") expect(b.texte.trim().length).toBeGreaterThan(0);
      if (b.type === "paragraphe") expect(texteBrut(b.texte).trim().length).toBeGreaterThan(0);
      if (b.type === "liste") expect(b.elements.length).toBeGreaterThan(0);
      if (b.type === "tableau") {
        expect(b.entete.length).toBeGreaterThan(0);
        for (const l of b.lignes) expect(l.length).toBe(b.entete.length);
      }
    }
  });

  it("ne garde aucun résidu de l'éditeur (identifiants, balises, marqueurs markdown)", () => {
    const texte = texteDuManuel(MANUEL);
    expect(texte).not.toMatch(/<\/?(text|paragraph|bold|cell|row|listItem)\b/);
    expect(texte).not.toMatch(/m9pn3g7z5pv|mr6fg9ex2pw|<\?claude/);
    expect(texte).not.toContain("**");
  });

  it("mentionne chaque entrée du menu et les notions clés (garde-fou contre la dérive)", () => {
    const texte = texteDuManuel(MANUEL);
    for (const g of MENU_METIER) for (const e of g.entrees) expect(texte, e.libelle).toContain(e.libelle);
    for (const mot of ["Ventilation", "Date bilan", "Rapprochement", "Clôturer", "Sauvegarde complète", "Solde de départ"]) {
      expect(texte.toLowerCase(), mot).toContain(mot.toLowerCase());
    }
  });
});

describe("accès au manuel", () => {
  it("l'entrée du menu pointe vers la page /manuel", () => {
    expect(ENTREE_MANUEL).toMatchObject({ href: "/manuel", libelle: "Manuel d'utilisation" });
  });
});
