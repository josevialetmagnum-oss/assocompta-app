"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { creerSession, detruireSession, hacherMotDePasse, session, verifierMotDePasse } from "@/lib/auth";

export type FormState = { errors: string[]; success?: string } | undefined;

export async function changerMotDePasse(_prevState: FormState, formData: FormData): Promise<FormState> {
  const utilisateurSession = await session();
  if (!utilisateurSession) redirect("/connexion");

  const actuel = String(formData.get("motDePasseActuel") ?? "");
  const nouveau = String(formData.get("nouveauMotDePasse") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  const erreurs: string[] = [];
  if (nouveau.length < 10) erreurs.push("Le nouveau mot de passe doit contenir au moins 10 caractères.");
  if (nouveau !== confirmation) erreurs.push("Les deux mots de passe ne correspondent pas.");
  if (erreurs.length) return { errors: erreurs };

  const utilisateur = await prisma.utilisateur.findUniqueOrThrow({ where: { id: utilisateurSession.id } });
  if (!(await verifierMotDePasse(actuel, utilisateur.motDePasseHash))) {
    return { errors: ["Mot de passe actuel incorrect."] };
  }

  // Les autres sessions de ce compte sont fermées ; celle-ci est ré-émise avec la nouvelle version
  // pour ne pas déconnecter la personne (voir sessionVersion, src/lib/auth.ts).
  const misAJour = await prisma.utilisateur.update({
    where: { id: utilisateur.id },
    data: { motDePasseHash: await hacherMotDePasse(nouveau), sessionVersion: { increment: 1 } },
  });
  await creerSession({
    id: misAJour.id,
    email: misAJour.email,
    role: misAJour.role,
    associationId: misAJour.associationId,
    sessionVersion: misAJour.sessionVersion,
  });

  return { errors: [], success: "Mot de passe modifié." };
}

export async function deconnecter() {
  await detruireSession();
  redirect("/connexion");
}
