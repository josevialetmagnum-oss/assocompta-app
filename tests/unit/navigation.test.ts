import { describe, expect, it } from "vitest";
import {
  entreeActive,
  entreesDuMenu,
  lectureSeuleSurCettePage,
  menuPour,
  MENU_METIER,
  peutVoirAdministration,
  peutVoirLeMetier,
} from "@/lib/navigation";

describe("menuPour", () => {
  it("le superviseur ne voit que l'administration, pas le menu métier", () => {
    const profil = { role: "superviseur", authentification: true };
    expect(peutVoirLeMetier(profil)).toBe(false);
    expect(peutVoirAdministration(profil)).toBe(true);
    const groupes = menuPour(profil);
    expect(groupes.some((g) => g.titre === "Administration")).toBe(true);
    expect(groupes.flatMap((g) => g.entrees).some((e) => e.href === "/mouvements")).toBe(false);
  });

  it("un trésorier voit le menu métier, pas l'administration", () => {
    const profil = { role: "tresorier", authentification: true };
    const groupes = menuPour(profil);
    expect(groupes.some((g) => g.titre === "Administration")).toBe(false);
    expect(groupes.flatMap((g) => g.entrees).some((e) => e.href === "/mouvements")).toBe(true);
    expect(groupes.flatMap((g) => g.entrees).some((e) => e.href === "/rapprochement")).toBe(true);
  });

  it("sans authentification (dev local), tout le métier est visible même sans rôle connu", () => {
    const profil = { role: "superviseur", authentification: false };
    expect(peutVoirLeMetier(profil)).toBe(true);
  });
});

describe("entreeActive", () => {
  const entrees = entreesDuMenu(MENU_METIER);

  it("l'accueil ne correspond qu'à /", () => {
    expect(entreeActive("/", entrees)).toBe("/");
    expect(entreeActive("/mouvements", entrees)).not.toBe("/");
  });

  it("une sous-page correspond à son entrée de menu", () => {
    expect(entreeActive("/mouvements", entrees)).toBe("/mouvements");
    expect(entreeActive("/parametrage", entrees)).toBe("/parametrage");
  });

  it("un chemin inconnu ne correspond à rien", () => {
    expect(entreeActive("/autre-chose", entrees)).toBeNull();
  });
});

describe("lectureSeuleSurCettePage", () => {
  it("s'applique aux pages métier pour un compte lecture seule", () => {
    expect(lectureSeuleSurCettePage("/mouvements", true)).toBe(true);
    expect(lectureSeuleSurCettePage("/rapprochement", true)).toBe(true);
    expect(lectureSeuleSurCettePage("/parametrage", true)).toBe(true);
  });

  it("ne s'applique jamais à l'administration ni au compte", () => {
    expect(lectureSeuleSurCettePage("/administration", true)).toBe(false);
    expect(lectureSeuleSurCettePage("/compte", true)).toBe(false);
  });

  it("ne s'applique à aucune page si le compte n'est pas en lecture seule", () => {
    expect(lectureSeuleSurCettePage("/mouvements", false)).toBe(false);
  });
});
