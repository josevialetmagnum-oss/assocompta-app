"use client";

import { useActionSansReinit } from "@/components/useActionSansReinit";
import { creerJournal, type FormState } from "./actions";

export function JournalForm() {
  const { etat: state, enCours: pending, onSubmit, formulaire } = useActionSansReinit<FormState>(creerJournal, { viderApresSucces: true });
  return (
    <form ref={formulaire} onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      {state?.errors && <div className="w-full rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">{state.errors.join(" ")}</div>}
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="text-neutral-600">Nom (ex. Caisse, Banque LCL)</span>
        <input name="nom" required className="input h-11" />
      </label>
      <button type="submit" disabled={pending} className="h-11 rounded-[10px] bg-neutral-900 px-4 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? "Ajout…" : "Ajouter"}
      </button>
    </form>
  );
}
