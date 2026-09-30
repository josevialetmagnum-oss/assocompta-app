import { describe, expect, it } from "vitest";
import { calculerDateBilan } from "@/lib/date-bilan";

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
