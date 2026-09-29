"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { authConfiguree, creerSession, verifierMotDePasse } from "@/lib/auth";

export type FormState = { errors: string[] } | undefined;

export async function connecter(_prevState: FormState, formData: FormData): Promise<FormState> {
  if (!authConfiguree()) {
    return { errors: ["L'authentification n'est pas configurée sur ce serveur (SESSION_SECRET manquante)."] };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const motDePasse = String(formData.get("motDePasse") ?? "");
  const suite = String(formData.get("suite") ?? "") || "/";

  // Message volontairement générique : ne pas révéler si un compte existe pour cette adresse.
  const erreur = "Email ou mot de passe incorrect.";
  if (!email || !motDePasse) return { errors: [erreur] };

  const utilisateur = await prisma.utilisateur.findUnique({ where: { email }, include: { association: true } });
  if (!utilisateur || !utilisateur.actif) return { errors: [erreur] };
  if (utilisateur.association && !utilisateur.association.actif) return { errors: [erreur] };

  const valide = await verifierMotDePasse(motDePasse, utilisateur.motDePasseHash);
  if (!valide) return { errors: [erreur] };

  await creerSession({
    id: utilisateur.id,
    email: utilisateur.email,
    role: utilisateur.role,
    associationId: utilisateur.associationId,
    sessionVersion: utilisateur.sessionVersion,
  });
  redirect(suite.startsWith("/") ? suite : "/");
}
