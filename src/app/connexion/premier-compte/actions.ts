"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { authConfiguree, creerSession, hacherMotDePasse } from "@/lib/auth";
import { validerEmail } from "@/lib/validation";

export type FormState = { errors: string[] } | undefined;

// Route à usage unique : ne fonctionne que tant qu'aucun compte n'existe, et seulement si
// BOOTSTRAP_ADMIN_PASSWORD est configurée sur le serveur. Crée le tout premier compte, en rôle
// superviseur (aucune association) : c'est lui qui crée ensuite les comptes des associations
// depuis /administration.
export async function creerPremierCompte(_prevState: FormState, formData: FormData): Promise<FormState> {
  if (!authConfiguree()) {
    return { errors: ["L'authentification n'est pas configurée sur ce serveur (SESSION_SECRET manquante)."] };
  }
  const cleDemarrage = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!cleDemarrage) {
    return { errors: ["La création du premier compte n'est pas activée (BOOTSTRAP_ADMIN_PASSWORD manquante)."] };
  }
  if ((await prisma.utilisateur.count()) > 0) {
    return { errors: ["Un compte existe déjà : cette page ne sert qu'à créer le tout premier compte."] };
  }

  const cleSaisie = String(formData.get("cleDemarrage") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const motDePasse = String(formData.get("motDePasse") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  const erreurs: string[] = [];
  if (cleSaisie !== cleDemarrage) erreurs.push("Clé de démarrage incorrecte.");
  if (!email || !validerEmail(email)) erreurs.push("Adresse email invalide.");
  if (motDePasse.length < 10) erreurs.push("Le mot de passe doit contenir au moins 10 caractères.");
  if (motDePasse !== confirmation) erreurs.push("Les deux mots de passe ne correspondent pas.");
  if (erreurs.length) return { errors: erreurs };

  const utilisateur = await prisma.utilisateur.create({
    data: { email, motDePasseHash: await hacherMotDePasse(motDePasse), role: "superviseur" },
  });

  await creerSession({
    id: utilisateur.id,
    email: utilisateur.email,
    role: utilisateur.role,
    associationId: utilisateur.associationId,
    sessionVersion: utilisateur.sessionVersion,
  });
  redirect("/administration");
}
