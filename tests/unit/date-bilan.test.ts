import { describe, expect, it } from "vitest";
import { calculerDateBilan, positionExercice } from "@/lib/date-bilan";

const exercice2025 = { id: 1, dateDebut: new Date("2025-01-01"), dateFin: new Date("2025-12-31") };
const exercice2026 = { id: 2, dateDebut: new Date("2026-01-01"), dateFin: new Date("2026-12-31") };
const exercice2027 = { id: 3, dateDebut: new Date("2027-01-01"), dateFin: new Date("2027-12-31") };

describe("calculerDateBilan", () => {
  it("exercice en cours : date bilan = date de saisie", () => {
    const saisie = new Date("2026-06-15");
    expect(calculerDateBilan(saisie, exercice2026, exercice2026)).toEqual(saisie);
  });

  it("exercice précédent : date bilan = la veille du début de l'exercice en cours", () => {
    const saisie = new Date("2025-11-20");
    expect(calculerDateBilan(saisie, exercice2025, exercice2026)).toEqual(new Date("2025-12-31"));
  });

  it("exercice suivant : date bilan = le lendemain de la fin de l'exercice en cours", () => {
    const saisie = new Date("2027-01-10");
    expect(calculerDateBilan(saisie, exercice2027, exercice2026)).toEqual(new Date("2027-01-01"));
  });

  it("sans exercice actif connu, la date de saisie est utilisée telle quelle", () => {
    const saisie = new Date("2026-06-15");
    expect(calculerDateBilan(saisie, exercice2026, null)).toEqual(saisie);
  });
});

describe("positionExercice", () => {
  it("l'exercice actif lui-même est \"en cours\"", () => {
    expect(positionExercice(exercice2026, exercice2026)).toBe("en_cours");
  });

  it("un exercice qui a commencé avant l'exercice actif est \"précédent\"", () => {
    expect(positionExercice(exercice2025, exercice2026)).toBe("precedent");
  });

  it("un exercice qui commence après l'exercice actif est \"suivant\"", () => {
    expect(positionExercice(exercice2027, exercice2026)).toBe("suivant");
  });

  it("sans exercice actif connu, tout exercice est considéré \"en cours\"", () => {
    expect(positionExercice(exercice2025, null)).toBe("en_cours");
  });
});
