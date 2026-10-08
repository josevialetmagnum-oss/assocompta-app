import { describe, expect, it } from "vitest";
import { baseUrlPublique, origineAutorisee, urlPublique } from "@/lib/url-publique";

const PROD = { NODE_ENV: "production", SITE_URL: "https://assocompta.lbsoft.fr/" };

describe("adresse publique derrière un frontal", () => {
  it("redirige vers SITE_URL en production, jamais vers l'adresse d'écoute du serveur", () => {
    const u = urlPublique("/connexion", "https://localhost:3002/", PROD);
    expect(u.href).toBe("https://assocompta.lbsoft.fr/connexion");
  });

  it("garde les paramètres ajoutés après coup", () => {
    const u = urlPublique("/connexion", "https://localhost:3002/mouvements", PROD);
    u.searchParams.set("suite", "/mouvements");
    expect(u.href).toBe("https://assocompta.lbsoft.fr/connexion?suite=%2Fmouvements");
  });

  it("sans SITE_URL (Vercel) : adresse de la requête", () => {
    expect(baseUrlPublique("https://assocompta.vercel.app/x", { NODE_ENV: "production" })).toBe("https://assocompta.vercel.app");
  });

  it("hors production : adresse de la requête, même si SITE_URL est définie (ports de développement variables)", () => {
    expect(baseUrlPublique("http://localhost:3020/x", { NODE_ENV: "development", SITE_URL: "http://localhost:3010" })).toBe(
      "http://localhost:3020",
    );
  });

  it("origine : accepte l'application elle-même, refuse un autre site ou une valeur illisible", () => {
    const requete = "https://localhost:3002/parametrage/import";
    expect(origineAutorisee("https://assocompta.lbsoft.fr", requete, PROD)).toBe(true);
    expect(origineAutorisee("https://autre-site.example", requete, PROD)).toBe(false);
    expect(origineAutorisee("https://localhost:3002", requete, PROD)).toBe(false);
    expect(origineAutorisee("pas une url", requete, PROD)).toBe(false);
  });
});
