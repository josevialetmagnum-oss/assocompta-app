import { prisma } from "@/lib/prisma";
import { hacherMotDePasse } from "@/lib/auth";
import { validerEmail } from "@/lib/validation";

// Comptes de consultation (rôle lecture_seule) d'une association : gérés par son trésorier lui-même
// (président, commissaire aux comptes...) — jamais par le superviseur, qui n'a accès à aucune
// donnée d'association (voir src/lib/association.ts).
export async function listerComptesAssociation(associationId: number) {
  return prisma.utilisateur.findMany({
    where: { associationId, role: "lecture_seule" },
    orderBy: { email: "asc" },
  });
}

export async function creerCompteLectureSeule(associationId: number, email: string, motDePasse: string) {
  const emailPropre = email.trim().toLowerCase();
  if (!validerEmail(emailPropre)) throw new Error("Adresse email invalide.");
  if (await prisma.utilisateur.findUnique({ where: { email: emailPropre } })) {
    throw new Error("Un compte existe déjà avec cet email.");
  }
  if (motDePasse.length < 10) throw new Error("Le mot de passe doit contenir au moins 10 caractères.");

  return prisma.utilisateur.create({
    data: { email: emailPropre, motDePasseHash: await hacherMotDePasse(motDePasse), role: "lecture_seule", associationId },
  });
}

// Bascule bornée à l'association de l'appelant (associationId) : un trésorier ne peut désactiver
// qu'un compte de consultation de sa propre association, jamais celui d'une autre.
export async function basculerActifCompte(id: number, associationId: number, actif: boolean) {
  await prisma.utilisateur.updateMany({
    where: { id, associationId, role: "lecture_seule" },
    data: { actif, sessionVersion: { increment: 1 } },
  });
}
