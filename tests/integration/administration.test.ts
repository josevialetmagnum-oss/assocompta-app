import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/association", async () => (await import("../support/contexte")).moduleAssociationDeTest());
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { prisma } from "@/lib/prisma";
import { basculerActifAssociation, creerAssociation, modifierAssociation, supprimerAssociation } from "@/lib/administration";
import { modifierAssociationAction, supprimerAssociationAction } from "@/app/administration/actions";
import { verifierMotDePasse } from "@/lib/auth";
import { creerJeuComplet, type Jeu } from "../support/jeu-de-donnees";
import { verifierBaseDeTest, viderBase } from "../support/base-test";

// Une association « bien remplie » : tous les types de données que la suppression doit emporter.
async function remplir(jeu: Jeu) {
  const rapprochement = await prisma.rapprochement.create({
    data: { associationId: jeu.associationId, journalId: jeu.journalId, date: new Date("2026-01-31"), solde: 50 },
  });
  await prisma.mouvement.create({
    data: {
      associationId: jeu.associationId, exerciceId: jeu.exerciceId, journalId: jeu.journalId, rapprochementId: rapprochement.id,
      date: new Date("2026-01-10"), dateBilan: new Date("2026-01-10"), type: "recette", typeTransaction: "especes", montant: 50, pointe: true,
      ventilations: { create: [{ sousCategorieId: jeu.sousCategorieRecette, montant: 50 }] },
    },
  });
  await prisma.soldeCloture.create({ data: { exerciceId: jeu.exerciceId, journalId: jeu.journalId, solde: 50 } });
  const utilisateur = await prisma.utilisateur.create({
    data: { email: `tresorier-${jeu.associationId}@test.local`, motDePasseHash: "x", role: "tresorier", associationId: jeu.associationId },
  });
  await prisma.reinitialisationMotDePasse.create({
    data: { utilisateurId: utilisateur.id, jetonHash: `jeton-${jeu.associationId}`, expireLe: new Date("2030-01-01") },
  });
}

async function compter(associationId: number) {
  return {
    utilisateurs: await prisma.utilisateur.count({ where: { associationId } }),
    mouvements: await prisma.mouvement.count({ where: { associationId } }),
    rapprochements: await prisma.rapprochement.count({ where: { associationId } }),
    exercices: await prisma.exercice.count({ where: { associationId } }),
    journaux: await prisma.journal.count({ where: { associationId } }),
    categories: await prisma.categorie.count({ where: { associationId } }),
    association: await prisma.association.count({ where: { id: associationId } }),
  };
}

describe("administration des associations", () => {
  beforeEach(async () => {
    verifierBaseDeTest();
    await viderBase();
  });

  describe("création", () => {
    it("crée l'association et son compte trésorier", async () => {
      const a = await creerAssociation("  Club de judo  ", "Tresorier@Judo.fr", "motdepasse-long");
      expect(a.nom).toBe("Club de judo");
      expect(a.actif).toBe(true);
      const u = await prisma.utilisateur.findUniqueOrThrow({ where: { email: "tresorier@judo.fr" } });
      expect(u).toMatchObject({ role: "tresorier", associationId: a.id, actif: true });
      expect(u.motDePasseHash).not.toBe("motdepasse-long");
    });

    it("refuse un nom vide, un email invalide ou déjà utilisé, un mot de passe trop court", async () => {
      await expect(creerAssociation("  ", "a@b.fr", "motdepasse-long")).rejects.toThrow();
      await expect(creerAssociation("Club", "pas-un-email", "motdepasse-long")).rejects.toThrow();
      await expect(creerAssociation("Club", "a@b.fr", "court")).rejects.toThrow();
      await creerAssociation("Club", "a@b.fr", "motdepasse-long");
      await expect(creerAssociation("Autre", "A@B.fr", "motdepasse-long")).rejects.toThrow();
      expect(await prisma.association.count()).toBe(1);
    });
  });

  describe("nom unique", () => {
    it("refuse deux associations de même nom, à la casse près", async () => {
      await creerAssociation("Club de judo", "a@b.fr", "motdepasse-long");
      await expect(creerAssociation("CLUB DE JUDO", "c@d.fr", "motdepasse-long")).rejects.toThrow("déjà ce nom");
      expect(await prisma.association.count()).toBe(1);
    });
  });

  describe("modification", () => {
    async function preparer() {
      const a = await creerAssociation("Club", "a@b.fr", "motdepasse-long");
      const autre = await creerAssociation("Autre club", "c@d.fr", "motdepasse-long");
      const t = await prisma.utilisateur.findUniqueOrThrow({ where: { email: "a@b.fr" } });
      const tAutre = await prisma.utilisateur.findUniqueOrThrow({ where: { email: "c@d.fr" } });
      return { a, autre, t, tAutre };
    }

    it("renomme l'association sans toucher au trésorier", async () => {
      const { a, t } = await preparer();
      expect(await modifierAssociation(a.id, "  Club renommé ", [{ id: t.id, email: "a@b.fr", motDePasse: "" }])).toEqual({ ok: true });
      expect((await prisma.association.findUniqueOrThrow({ where: { id: a.id } })).nom).toBe("Club renommé");
      const apres = await prisma.utilisateur.findUniqueOrThrow({ where: { id: t.id } });
      expect(apres.email).toBe("a@b.fr");
      expect(apres.sessionVersion).toBe(t.sessionVersion);
      expect(apres.motDePasseHash).toBe(t.motDePasseHash);
    });

    it("change l'email et le mot de passe du trésorier, et ferme ses sessions", async () => {
      const { a, t } = await preparer();
      const res = await modifierAssociation(a.id, "Club", [{ id: t.id, email: "Nouveau@B.fr", motDePasse: "nouveau-mdp-long" }]);
      expect(res).toEqual({ ok: true });
      const apres = await prisma.utilisateur.findUniqueOrThrow({ where: { id: t.id } });
      expect(apres.email).toBe("nouveau@b.fr");
      expect(apres.sessionVersion).toBe(t.sessionVersion + 1);
      expect(await verifierMotDePasse("nouveau-mdp-long", apres.motDePasseHash)).toBe(true);
      expect(await verifierMotDePasse("motdepasse-long", apres.motDePasseHash)).toBe(false);
    });

    it("refuse sans rien écrire : nom vide ou déjà pris, email invalide ou déjà utilisé, mot de passe court", async () => {
      const { a, t } = await preparer();
      const base = [{ id: t.id, email: "a@b.fr", motDePasse: "" }];
      const cas: [string, typeof base][] = [
        ["", base],
        ["autre CLUB", base],
        ["Club", [{ id: t.id, email: "pas-un-email", motDePasse: "" }]],
        ["Club", [{ id: t.id, email: "c@d.fr", motDePasse: "" }]],
        ["Club", [{ id: t.id, email: "a@b.fr", motDePasse: "court" }]],
      ];
      for (const [nom, tresoriers] of cas) {
        expect((await modifierAssociation(a.id, nom, tresoriers)).ok).toBe(false);
      }
      const intact = await prisma.association.findUniqueOrThrow({ where: { id: a.id } });
      expect(intact.nom).toBe("Club");
      expect((await prisma.utilisateur.findUniqueOrThrow({ where: { id: t.id } })).email).toBe("a@b.fr");
    });

    it("une erreur sur le compte n'applique pas non plus le nouveau nom", async () => {
      const { a, t } = await preparer();
      const res = await modifierAssociation(a.id, "Nouveau nom", [{ id: t.id, email: "c@d.fr", motDePasse: "" }]);
      expect(res.ok).toBe(false);
      expect((await prisma.association.findUniqueOrThrow({ where: { id: a.id } })).nom).toBe("Club");
    });

    it("ne modifie jamais le compte d'une autre association", async () => {
      const { a, tAutre } = await preparer();
      const res = await modifierAssociation(a.id, "Club", [{ id: tAutre.id, email: "pirate@x.fr", motDePasse: "pirate-mdp-long" }]);
      expect(res.ok).toBe(false);
      const intact = await prisma.utilisateur.findUniqueOrThrow({ where: { id: tAutre.id } });
      expect(intact.email).toBe("c@d.fr");
      expect(intact.sessionVersion).toBe(tAutre.sessionVersion);
    });

    it("ne touche pas à un compte de consultation de l'association", async () => {
      const { a } = await preparer();
      const lecture = await prisma.utilisateur.create({
        data: { email: "lecture@b.fr", motDePasseHash: "x", role: "lecture_seule", associationId: a.id },
      });
      const res = await modifierAssociation(a.id, "Club", [{ id: lecture.id, email: "autre@b.fr", motDePasse: "" }]);
      expect(res.ok).toBe(false);
      expect((await prisma.utilisateur.findUniqueOrThrow({ where: { id: lecture.id } })).email).toBe("lecture@b.fr");
    });

    it("refuse une association inexistante", async () => {
      expect((await modifierAssociation(999999, "X", [])).ok).toBe(false);
    });

    it("l'action lit les champs du formulaire et renvoie les erreurs", async () => {
      const { a, t } = await preparer();
      const fd = new FormData();
      fd.set("id", String(a.id));
      fd.set("nom", "Via formulaire");
      fd.set("tresoriers", String(t.id));
      fd.set(`email_${t.id}`, "form@b.fr");
      fd.set(`motDePasse_${t.id}`, "");
      expect(await modifierAssociationAction(undefined, fd)).toBeUndefined();
      expect((await prisma.association.findUniqueOrThrow({ where: { id: a.id } })).nom).toBe("Via formulaire");
      expect((await prisma.utilisateur.findUniqueOrThrow({ where: { id: t.id } })).email).toBe("form@b.fr");

      fd.set("nom", "");
      expect(await modifierAssociationAction(undefined, fd)).toEqual({ errors: [expect.stringContaining("nom")] });
    });
  });

  describe("blocage", () => {
    it("bloquer ferme les sessions de ses comptes et conserve les données ; débloquer la rouvre", async () => {
      const a = await creerAssociation("Club", "a@b.fr", "motdepasse-long");
      const avant = await prisma.utilisateur.findUniqueOrThrow({ where: { email: "a@b.fr" } });

      await basculerActifAssociation(a.id, false);
      expect((await prisma.association.findUniqueOrThrow({ where: { id: a.id } })).actif).toBe(false);
      const apres = await prisma.utilisateur.findUniqueOrThrow({ where: { email: "a@b.fr" } });
      expect(apres.sessionVersion).toBe(avant.sessionVersion + 1);

      await basculerActifAssociation(a.id, true);
      expect((await prisma.association.findUniqueOrThrow({ where: { id: a.id } })).actif).toBe(true);
    });

    it("ne touche pas aux comptes d'une autre association", async () => {
      const a = await creerAssociation("Club A", "a@b.fr", "motdepasse-long");
      await creerAssociation("Club B", "b@b.fr", "motdepasse-long");
      await basculerActifAssociation(a.id, false);
      const b = await prisma.utilisateur.findUniqueOrThrow({ where: { email: "b@b.fr" } });
      expect(b.sessionVersion).toBe(0);
    });
  });

  describe("suppression", () => {
    let jeu: Jeu;

    beforeEach(async () => {
      jeu = await creerJeuComplet();
      await remplir(jeu);
    });

    it("refuse de supprimer une association qui n'est pas bloquée", async () => {
      const res = await supprimerAssociation(jeu.associationId, "Association test");
      expect(res.ok).toBe(false);
      expect((await compter(jeu.associationId)).mouvements).toBe(1);
    });

    it("refuse si le nom retapé ne correspond pas exactement", async () => {
      await basculerActifAssociation(jeu.associationId, false);
      for (const nom of ["", "association test", "Association tes", "Autre"]) {
        expect((await supprimerAssociation(jeu.associationId, nom)).ok).toBe(false);
      }
      expect((await compter(jeu.associationId)).association).toBe(1);
    });

    it("supprime l'association bloquée avec toutes ses données", async () => {
      await basculerActifAssociation(jeu.associationId, false);
      expect(await supprimerAssociation(jeu.associationId, "Association test")).toEqual({ ok: true });

      expect(await compter(jeu.associationId)).toEqual({
        utilisateurs: 0, mouvements: 0, rapprochements: 0, exercices: 0, journaux: 0, categories: 0, association: 0,
      });
      expect(await prisma.mouvementVentilation.count()).toBe(0);
      expect(await prisma.soldeCloture.count()).toBe(0);
      expect(await prisma.sousCategorie.count()).toBe(0);
      expect(await prisma.reinitialisationMotDePasse.count()).toBe(0);
    });

    it("ne supprime rien d'une autre association, ni le compte superviseur", async () => {
      const autre = await creerJeuComplet();
      await remplir(autre);
      await prisma.utilisateur.create({ data: { email: "super@lbsoft.fr", motDePasseHash: "x", role: "superviseur" } });
      const avant = await compter(autre.associationId);

      await basculerActifAssociation(jeu.associationId, false);
      await supprimerAssociation(jeu.associationId, "Association test");

      expect(await compter(autre.associationId)).toEqual(avant);
      expect(await prisma.utilisateur.count({ where: { role: "superviseur" } })).toBe(1);
    });

    it("l'action renvoie l'erreur au lieu de supprimer, puis supprime quand tout est réuni", async () => {
      expect(await supprimerAssociationAction(jeu.associationId, "Association test")).toEqual({
        error: expect.stringContaining("Bloquez"),
      });
      await basculerActifAssociation(jeu.associationId, false);
      expect(await supprimerAssociationAction(jeu.associationId, "faux nom")).toEqual({ error: expect.stringContaining("nom") });
      expect(await supprimerAssociationAction(jeu.associationId, "Association test")).toEqual({});
      expect((await compter(jeu.associationId)).association).toBe(0);
    });

    it("refuse une association inexistante", async () => {
      expect((await supprimerAssociation(999999, "x")).ok).toBe(false);
    });
  });
});
