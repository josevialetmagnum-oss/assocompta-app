import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/association", async () => (await import("../support/contexte")).moduleAssociationDeTest());
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { prisma } from "@/lib/prisma";
import { basculerActifCompteAction, creerCompteLectureSeuleAction } from "@/app/parametrage/actions";
import { creerJeuComplet, type Jeu } from "../support/jeu-de-donnees";
import { verifierBaseDeTest, viderBase } from "../support/base-test";
import { contexte } from "../support/contexte";

function formData(champs: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) fd.set(k, v);
  return fd;
}

describe("comptes de consultation (lecture_seule)", () => {
  let jeuA: Jeu;
  let jeuB: Jeu;

  beforeEach(async () => {
    verifierBaseDeTest();
    await viderBase();
    jeuA = await creerJeuComplet();
    jeuB = await creerJeuComplet();
    contexte.associationId = jeuA.associationId;
    contexte.lectureSeule = false;
  });

  it("le trésorier crée un compte de consultation rattaché à sa propre association", async () => {
    const res = await creerCompteLectureSeuleAction(undefined, formData({ email: "president@example.com", motDePasse: "president-mdp" }));
    expect(res?.errors).toBeUndefined();
    const compte = await prisma.utilisateur.findUniqueOrThrow({ where: { email: "president@example.com" } });
    expect(compte.role).toBe("lecture_seule");
    expect(compte.associationId).toBe(jeuA.associationId);
  });

  it("refuse un email déjà utilisé", async () => {
    await creerCompteLectureSeuleAction(undefined, formData({ email: "president@example.com", motDePasse: "president-mdp" }));
    const res = await creerCompteLectureSeuleAction(undefined, formData({ email: "president@example.com", motDePasse: "autre-mdp-12" }));
    expect(res?.errors).toEqual(["Un compte existe déjà avec cet email."]);
  });

  it("un compte lecture_seule ne peut pas créer de compte de consultation", async () => {
    contexte.lectureSeule = true;
    await expect(
      creerCompteLectureSeuleAction(undefined, formData({ email: "x@example.com", motDePasse: "abcdefghij" })),
    ).rejects.toThrow();
  });

  it("désactiver un compte de consultation d'une AUTRE association n'a aucun effet (cloisonnement)", async () => {
    await creerCompteLectureSeuleAction(undefined, formData({ email: "president-a@example.com", motDePasse: "president-mdp" }));
    const compteA = await prisma.utilisateur.findUniqueOrThrow({ where: { email: "president-a@example.com" } });

    contexte.associationId = jeuB.associationId;
    await basculerActifCompteAction(compteA.id, false);

    const relu = await prisma.utilisateur.findUniqueOrThrow({ where: { id: compteA.id } });
    expect(relu.actif).toBe(true);
  });
});
