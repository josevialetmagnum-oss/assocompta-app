"use server";

import { appliquerReinitialisation } from "@/lib/reinitialisation-mdp";

export type FormState = { errors: string[]; termine?: boolean } | undefined;

export async function reinitialiser(_prevState: FormState, formData: FormData): Promise<FormState> {
  const r = await appliquerReinitialisation(
    String(formData.get("jeton") ?? ""),
    String(formData.get("nouveauMotDePasse") ?? ""),
    String(formData.get("confirmation") ?? ""),
  );
  return r.ok ? { errors: [], termine: true } : { errors: [r.erreur] };
}
