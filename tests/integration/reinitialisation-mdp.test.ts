import { beforeEach, describe, expect, it, vi } from "vitest";

const emailsEnvoyes: { to: string; subject: string; text: string }[] = [];
vi.mock("@/lib/email", () => ({
  envoyerEmailPlateforme: async (mail: { to: string; subject: string; text: string }) => {
    emailsEnvoyes.push(mail);
  },
}));

import { prisma } from "@/lib/prisma";
import { hacherMotDePasse, verifierMotDePasse } from "@/lib/auth";
import {
  appliquerReinitialisation,
  demanderReinitialisation,
  jetonValide,
} from "@/lib/reinitialisation-mdp";
import { verifierBaseDeTest, viderBase } from "../support/base-test";

function extraireJeton(texte: string): string {
  const m = texte.match(/jeton=([0-9a-f]+)/);
  if (!m) throw new Error("Jeton introuvable dans l'email : " + texte);
  return m[1];
}

describe("mot de passe oublié", () => {
  beforeEach(async () => {
    verifierBaseDeTest();
    await viderBase();
    emailsEnvoyes.length = 0;
  });

  it("envoie un email avec un lien à usage unique pour un compte existant et actif", async () => {
    await prisma.utilisateur.create({
      data: { email: "compte@example.com", motDePasseHash: await hacherMotDePasse("ancien-mdp-1"), role: "superviseur" },
    });

    await demanderReinitialisation("Compte@Example.com");

    expect(emailsEnvoyes).toHaveLength(1);
    expect(emailsEnvoyes[0].to).toBe("compte@example.com");
    const jeton = extraireJeton(emailsEnvoyes[0].text);
    expect(await jetonValide(jeton)).toBe(true);
  });

  it("n'envoie rien pour un email inexistant, sans erreur (pas d'énumération)", async () => {
    await expect(demanderReinitialisation("inconnu@example.com")).resolves.toBeUndefined();
    expect(emailsEnvoyes).toHaveLength(0);
  });

  it("n'envoie rien pour un compte désactivé", async () => {
    await prisma.utilisateur.create({
      data: { email: "desactive@example.com", motDePasseHash: await hacherMotDePasse("ancien-mdp-1"), role: "superviseur", actif: false },
    });
    await demanderReinitialisation("desactive@example.com");
    expect(emailsEnvoyes).toHaveLength(0);
  });

  it("limite à 3 demandes par heure pour le même compte", async () => {
    await prisma.utilisateur.create({
      data: { email: "compte@example.com", motDePasseHash: await hacherMotDePasse("ancien-mdp-1"), role: "superviseur" },
    });
    for (let i = 0; i < 3; i++) await demanderReinitialisation("compte@example.com");
    await demanderReinitialisation("compte@example.com");
    expect(emailsEnvoyes).toHaveLength(3);
  });

  it("applique le nouveau mot de passe, ferme les sessions, et le jeton devient à usage unique", async () => {
    const u = await prisma.utilisateur.create({
      data: { email: "compte@example.com", motDePasseHash: await hacherMotDePasse("ancien-mdp-1"), role: "superviseur" },
    });
    await demanderReinitialisation("compte@example.com");
    const jeton = extraireJeton(emailsEnvoyes[0].text);

    const res = await appliquerReinitialisation(jeton, "nouveau-mdp-12", "nouveau-mdp-12");
    expect(res).toEqual({ ok: true });

    const relu = await prisma.utilisateur.findUniqueOrThrow({ where: { id: u.id } });
    expect(await verifierMotDePasse("nouveau-mdp-12", relu.motDePasseHash)).toBe(true);
    expect(relu.sessionVersion).toBe(1);

    // Le jeton est à usage unique.
    const rejeu = await appliquerReinitialisation(jeton, "encore-un-autre-1", "encore-un-autre-1");
    expect(rejeu.ok).toBe(false);
  });

  it("refuse un mot de passe trop court ou une confirmation différente", async () => {
    await prisma.utilisateur.create({
      data: { email: "compte@example.com", motDePasseHash: await hacherMotDePasse("ancien-mdp-1"), role: "superviseur" },
    });
    await demanderReinitialisation("compte@example.com");
    const jeton = extraireJeton(emailsEnvoyes[0].text);

    expect((await appliquerReinitialisation(jeton, "court", "court")).ok).toBe(false);
    expect((await appliquerReinitialisation(jeton, "un-mot-de-passe-1", "different-mdp-1")).ok).toBe(false);
  });

  it("refuse un jeton inconnu ou expiré", async () => {
    expect(await jetonValide("jeton-inexistant")).toBe(false);
    expect((await appliquerReinitialisation("jeton-inexistant", "nouveau-mdp-12", "nouveau-mdp-12")).ok).toBe(false);
  });
});
