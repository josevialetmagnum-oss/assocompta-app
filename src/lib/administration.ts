import { prisma } from "@/lib/prisma";
import { hacherMotDePasse } from "@/lib/auth";
import { validerEmail } from "@/lib/validation";

export async function listerAssociations() {
  return prisma.association.findMany({
    orderBy: { nom: "asc" },
    include: { utilisateurs: { where: { role: "tresorier" }, select: { email: true, actif: true } } },
  });
}

// Crée une association et son premier compte trésorier. Le mot de passe est saisi directement par
// le superviseur (comme creerCompteNegociant sur raisins-app) : à communiquer au trésorier.
export async function creerAssociation(nom: string, emailTresorier: string, motDePasse: string) {
  const nomPropre = nom.trim();
  if (!nomPropre) throw new Error("Le nom de l'association est obligatoire.");
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
