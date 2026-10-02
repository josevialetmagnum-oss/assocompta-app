import { prisma } from "@/lib/prisma";
import { hacherMotDePasse } from "@/lib/auth";
import { validerEmail } from "@/lib/validation";

export async function listerAssociations() {
  return prisma.association.findMany({
    orderBy: { nom: "asc" },
    include: { utilisateurs: { where: { role: "tresorier" }, orderBy: { id: "asc" }, select: { id: true, email: true, actif: true } } },
  });
}

// Crée une association et son premier compte trésorier. Le mot de passe est saisi directement par
// le superviseur (comme creerCompteNegociant sur raisins-app) : à communiquer au trésorier.
// Deux associations ne portent pas le même nom (à la casse près) : la suppression se confirme en
// retapant le nom, il doit désigner sans ambiguïté une seule association.
async function nomDejaPris(nom: string, exceptId?: number): Promise<boolean> {
  const existante = await prisma.association.findFirst({
    where: { nom: { equals: nom, mode: "insensitive" }, ...(exceptId !== undefined ? { id: { not: exceptId } } : {}) },
  });
  return existante !== null;
}

export async function creerAssociation(nom: string, emailTresorier: string, motDePasse: string) {
  const nomPropre = nom.trim();
  if (!nomPropre) throw new Error("Le nom de l'association est obligatoire.");
  if (await nomDejaPris(nomPropre)) throw new Error("Une association porte déjà ce nom.");
  const email = emailTresorier.trim().toLowerCase();
  if (!validerEmail(email)) throw new Error("Adresse email invalide.");
  if (await prisma.utilisateur.findUnique({ where: { email } })) throw new Error("Un compte existe déjà avec cet email.");
  if (motDePasse.length < 10) throw new Error("Le mot de passe doit contenir au moins 10 caractères.");

  return prisma.$transaction(async (tx) => {
    const association = await tx.association.create({ data: { nom: nomPropre } });
    await tx.utilisateur.create({
      data: { email, motDePasseHash: await hacherMotDePasse(motDePasse), role: "tresorier", associationId: association.id },
    });
    return association;
  });
}

export async function basculerActifAssociation(id: number, actif: boolean) {
  await prisma.association.update({ where: { id }, data: { actif } });
  // Coupe l'accès des comptes de l'association (jetons déjà émis compris) sans les désactiver
  // individuellement, en incrémentant leur sessionVersion (voir src/lib/auth.ts).
  if (!actif) {
    await prisma.utilisateur.updateMany({ where: { associationId: id }, data: { sessionVersion: { increment: 1 } } });
  }
}

export type ResultatSuppression = { ok: true } | { ok: false; erreur: string };

// Supprime définitivement une association et TOUTES ses données (mouvements, rapprochements,
// exercices, catégories, journaux, comptes). Irréversible, donc trois garde-fous revérifiés ici,
// jamais fiés à l'écran : l'association doit d'abord être bloquée (suspendue), et le nom exact doit
// être retapé. Les comptes sont supprimés avec elle, ce qui ferme leurs sessions.
export async function supprimerAssociation(id: number, nomConfirme: string): Promise<ResultatSuppression> {
  const association = await prisma.association.findUnique({ where: { id } });
  if (!association) return { ok: false, erreur: "Association introuvable." };
  if (association.actif) return { ok: false, erreur: "Bloquez d'abord l'association avant de la supprimer." };
  if (nomConfirme.trim() !== association.nom) return { ok: false, erreur: "Le nom saisi ne correspond pas : suppression annulée." };

  await prisma.$transaction(async (tx) => {
    await tx.mouvementVentilation.deleteMany({ where: { mouvement: { associationId: id } } });
    await tx.mouvement.deleteMany({ where: { associationId: id } });
    await tx.rapprochement.deleteMany({ where: { associationId: id } });
    await tx.soldeCloture.deleteMany({ where: { exercice: { associationId: id } } });
    await tx.sousCategorie.deleteMany({ where: { categorie: { associationId: id } } });
    await tx.categorie.deleteMany({ where: { associationId: id } });
    await tx.journal.deleteMany({ where: { associationId: id } });
    await tx.exercice.deleteMany({ where: { associationId: id } });
    await tx.utilisateur.deleteMany({ where: { associationId: id } });
    await tx.association.delete({ where: { id } });
  });
  return { ok: true };
}

export type ModificationTresorier = { id: number; email: string; motDePasse: string };
export type ResultatModification = { ok: true } | { ok: false; erreur: string };

// Modifie le nom d'une association et, pour ses comptes trésorier, l'email et/ou le mot de passe
// (laissé vide = inchangé). Tout est validé avant la moindre écriture. Un compte dont l'email ou le
// mot de passe change voit ses sessions fermées (sessionVersion) : il doit se reconnecter.
export async function modifierAssociation(id: number, nom: string, tresoriers: ModificationTresorier[]): Promise<ResultatModification> {
  const association = await prisma.association.findUnique({ where: { id }, include: { utilisateurs: { where: { role: "tresorier" } } } });
  if (!association) return { ok: false, erreur: "Association introuvable." };

  const nomPropre = nom.trim();
  if (!nomPropre) return { ok: false, erreur: "Le nom de l'association est obligatoire." };
  if (await nomDejaPris(nomPropre, id)) return { ok: false, erreur: "Une association porte déjà ce nom." };

  const miseAJour: { id: number; data: { email?: string; motDePasseHash?: string; sessionVersion?: { increment: number } } }[] = [];
  for (const t of tresoriers) {
    const compte = association.utilisateurs.find((u) => u.id === t.id);
    if (!compte) return { ok: false, erreur: "Compte trésorier introuvable pour cette association." };

    const data: (typeof miseAJour)[number]["data"] = {};
    const email = t.email.trim().toLowerCase();
    if (email !== compte.email) {
      if (!validerEmail(email)) return { ok: false, erreur: `Adresse email invalide : ${t.email}` };
      if (await prisma.utilisateur.findUnique({ where: { email } })) return { ok: false, erreur: `Un compte existe déjà avec l'email ${email}.` };
      data.email = email;
    }
    if (t.motDePasse !== "") {
      if (t.motDePasse.length < 10) return { ok: false, erreur: "Le mot de passe doit contenir au moins 10 caractères." };
      data.motDePasseHash = await hacherMotDePasse(t.motDePasse);
    }
    if (data.email !== undefined || data.motDePasseHash !== undefined) {
      data.sessionVersion = { increment: 1 };
      miseAJour.push({ id: compte.id, data });
    }
  }

  // Deux comptes de la même association ne peuvent pas recevoir le même nouvel email.
  const nouveauxEmails = miseAJour.map((m) => m.data.email).filter((e): e is string => e !== undefined);
  if (new Set(nouveauxEmails).size !== nouveauxEmails.length) return { ok: false, erreur: "Deux comptes ne peuvent pas avoir le même email." };

  await prisma.$transaction(async (tx) => {
    await tx.association.update({ where: { id }, data: { nom: nomPropre } });
    for (const m of miseAJour) await tx.utilisateur.update({ where: { id: m.id }, data: m.data });
  });
  return { ok: true };
}
