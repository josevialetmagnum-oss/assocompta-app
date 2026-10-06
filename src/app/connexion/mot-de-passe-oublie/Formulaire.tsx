"use client";

import { useActionSansReinit } from "@/components/useActionSansReinit";
import { demanderLien, type FormState } from "./actions";

export function FormulaireMotDePasseOublie() {
  const { etat: state, enCours: pending, onSubmit, formulaire } = useActionSansReinit<FormState>(demanderLien);

  if (state?.envoye) {
    return (
      <p className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
        Si un compte correspond à cette adresse, un email contenant un lien de réinitialisation vient d&apos;être
        envoyé (valable 1 heure). Pensez à vérifier vos courriers indésirables.
      </p>
    );
  }

  return (
    <form ref={formulaire} onSubmit={onSubmit} className="flex w-full flex-col gap-4">
      <label className="flex flex-col gap-1 text-[15px]">
        <span className="text-neutral-600">Email du compte</span>
        <input name="email" type="email" autoComplete="username" required autoFocus className="input h-11" />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-[10px] bg-neutral-900 px-4 text-base font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Envoi…" : "Envoyer le lien"}
      </button>
    </form>
  );
}
