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
