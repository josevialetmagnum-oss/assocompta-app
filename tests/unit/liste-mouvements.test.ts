import { describe, expect, it } from "vitest";
import { lireFiltreMouvements } from "@/lib/liste-mouvements";

describe("lireFiltreMouvements", () => {
  it("sans paramètre, filtre sur l'exercice en cours et sur aucun compte", () => {
    expect(lireFiltreMouvements({}, 7)).toEqual({ journalId: undefined, exerciceId: 7 });
  });

  it("un exercice vide signifie « Tous » (et non l'exercice en cours)", () => {
    expect(lireFiltreMouvements({ exercice: "" }, 7)).toEqual({ journalId: undefined, exerciceId: undefined });
  });

  it("lit le compte et l'exercice demandés", () => {
    expect(lireFiltreMouvements({ journal: "3", exercice: "5" }, 7)).toEqual({ journalId: 3, exerciceId: 5 });
  });

  it("ignore un identifiant illisible, négatif ou décimal", () => {
    for (const v of ["abc", "-2", "0", "1.5", " "]) {
      expect(lireFiltreMouvements({ journal: v }, 7).journalId).toBeUndefined();
    }
    expect(lireFiltreMouvements({ exercice: "abc" }, 7).exerciceId).toBeUndefined();
  });

  it("sans exercice en cours, exercice absent = tous", () => {
    expect(lireFiltreMouvements({}, undefined).exerciceId).toBeUndefined();
  });
});
