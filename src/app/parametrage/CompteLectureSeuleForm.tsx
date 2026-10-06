"use client";

import { useActionSansReinit } from "@/components/useActionSansReinit";
import { creerCompteLectureSeuleAction, type FormState } from "./actions";

export function CompteLectureSeuleForm() {
  const { etat: state, enCours: pending, onSubmit, formulaire } = useActionSansReinit<FormState>(creerCompteLectureSeuleAction, { viderApresSucces: true });
  return (
    <form ref={formulaire} onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      {state?.errors && <div className="w-full rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">{state.errors.join(" ")}</div>}
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="text-neutral-600">Email</span>
        <input name="email" type="email" required className="input h-11" />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="text-neutral-600">Mot de passe initial</span>
        <input name="motDePasse" type="text" required minLength={10} className="input h-11" />
      </label>
      <button type="submit" disabled={pending} className="h-11 rounded-[10px] bg-neutral-900 px-4 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? "Création…" : "Ajouter"}
      </button>
    </form>
  );
}
