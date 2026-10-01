"use server";

import { revalidatePath } from "next/cache";
import { associationCourante, exigerEcriture } from "@/lib/association";
import { supprimerDernierRapprochement, validerRapprochement } from "@/lib/rapprochement";

export type FormState = { error: string } | undefined;

export async function validerRapprochementAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  await exigerEcriture();
  const associationId = await associationCourante();
  const journalId = Number(formData.get("journalId"));
  const dateReleveBrut = String(formData.get("date") ?? "");
  const soldeReleveBrut = String(formData.get("solde") ?? "");
  if (!dateReleveBrut || soldeReleveBrut === "") return { error: "La date et le solde du relevé sont obligatoires." };

  const res = await validerRapprochement(associationId, journalId, new Date(dateReleveBrut), Number(soldeReleveBrut));
  if (!res.ok) return { error: res.erreur };

  revalidatePath("/rapprochement");
  revalidatePath("/mouvements");
}

export async function supprimerDernierRapprochementAction(journalId: number): Promise<{ error?: string }> {
  await exigerEcriture();
  const associationId = await associationCourante();
  const res = await supprimerDernierRapprochement(associationId, journalId);
  if (!res.ok) return { error: res.erreur };

  revalidatePath("/rapprochement");
  revalidatePath("/mouvements");
  return {};
}
