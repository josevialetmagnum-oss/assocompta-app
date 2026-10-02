"use server";

import { revalidatePath } from "next/cache";
import { exigerSuperviseur } from "@/lib/association";
import { creerAssociation, basculerActifAssociation, supprimerAssociation } from "@/lib/administration";

export type FormState = { errors: string[] } | undefined;

export async function creerAssociationAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  await exigerSuperviseur();
  const nom = String(formData.get("nom") ?? "");
  const email = String(formData.get("email") ?? "");
  const motDePasse = String(formData.get("motDePasse") ?? "");

  try {
    await creerAssociation(nom, email, motDePasse);
  } catch (e) {
    return { errors: [e instanceof Error ? e.message : "Erreur inattendue."] };
  }
  revalidatePath("/administration");
}

export async function basculerActif(id: number, actif: boolean): Promise<void> {
  await exigerSuperviseur();
  await basculerActifAssociation(id, actif);
  revalidatePath("/administration");
}

export async function supprimerAssociationAction(id: number, nomConfirme: string): Promise<{ error?: string }> {
  await exigerSuperviseur();
  const res = await supprimerAssociation(id, nomConfirme);
  if (!res.ok) return { error: res.erreur };
  revalidatePath("/administration");
  return {};
}
