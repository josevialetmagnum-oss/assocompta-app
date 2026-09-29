import { afterEach, describe, expect, it, vi } from "vitest";

// session() doit pouvoir varier d'un test à l'autre — voir src/lib/association.ts, qui l'appelle
// directement (jamais authConfiguree() : contrairement à raisins-app, AssoCompta n'a pas de phase
// historique sans authentification à préserver — une association n'a pas de "tenant implicite"
// vers lequel se replier sans session).
const etat = vi.hoisted(() => ({
  courant: null as { id: number; email: string; role: string; associationId: number | null } | null,
}));
vi.mock("@/lib/auth", () => ({ session: async () => etat.courant }));

import { AccesAssociationRefuse, ConnexionRequise, EcritureRefusee, exigerEcriture, exigerSuperviseur } from "@/lib/association";

function compte(role: string, associationId: number | null = 1) {
  return { id: 1, email: "compte@example.com", role, associationId };
}

describe("exigerEcriture : lecture seule bloquée, trésorier autorisé", () => {
  afterEach(() => {
    etat.courant = null;
  });

  it("refuse un compte lecture_seule", async () => {
    etat.courant = compte("lecture_seule");
    await expect(exigerEcriture()).rejects.toBeInstanceOf(EcritureRefusee);
  });

  it("l'erreur est bien une AccesAssociationRefuse (même famille que le cloisonnement)", async () => {
    etat.courant = compte("lecture_seule");
    await expect(exigerEcriture()).rejects.toBeInstanceOf(AccesAssociationRefuse);
  });

  it("laisse passer un trésorier", async () => {
    etat.courant = compte("tresorier");
    await expect(exigerEcriture()).resolves.toBeUndefined();
  });

  it("sans session, lève ConnexionRequise (jamais atteint en pratique : la page a déjà redirigé)", async () => {
    etat.courant = null;
    await expect(exigerEcriture()).rejects.toBeInstanceOf(ConnexionRequise);
  });
});

describe("exigerSuperviseur", () => {
  afterEach(() => {
    etat.courant = null;
  });

  it("laisse passer un superviseur", async () => {
    etat.courant = compte("superviseur", null);
    await expect(exigerSuperviseur()).resolves.toBeUndefined();
  });

  it.each(["tresorier", "lecture_seule"])("refuse un compte %s", async (role) => {
    etat.courant = compte(role);
    await expect(exigerSuperviseur()).rejects.toBeInstanceOf(AccesAssociationRefuse);
  });

  it("sans session, lève ConnexionRequise", async () => {
    etat.courant = null;
    await expect(exigerSuperviseur()).rejects.toBeInstanceOf(ConnexionRequise);
  });
});
