"use server";

import { demanderReinitialisation } from "@/lib/reinitialisation-mdp";

export type FormState = { envoye: boolean } | undefined;

// Même réponse que l'email existe ou non (voir src/lib/reinitialisation-mdp.ts).
export async function demanderLien(_prevState: FormState, formData: FormData): Promise<FormState> {
  await demanderReinitialisation(String(formData.get("email") ?? ""));
  return { envoye: true };
}
