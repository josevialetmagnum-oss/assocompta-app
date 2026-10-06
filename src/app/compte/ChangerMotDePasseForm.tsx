"use client";

import { useActionSansReinit } from "@/components/useActionSansReinit";
import { changerMotDePasse, type FormState } from "./actions";

export function ChangerMotDePasseForm() {
  const { etat: state, enCours: pending, onSubmit, formulaire } = useActionSansReinit<FormState>(changerMotDePasse, { viderMotsDePasse: true });

  return (
    <form ref={formulaire} onSubmit={onSubmit} className="flex max-w-sm flex-col gap-3">
      {state && state.errors.length > 0 && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {state.errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}
      {state?.success && (
        <div className="rounded border border-green-300 bg-green-50 p-2 text-sm text-green-700">{state.success}</div>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-neutral-600">Mot de passe actuel</span>
        <input name="motDePasseActuel" type="password" autoComplete="current-password" required className="input h-11" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-neutral-600">Nouveau mot de passe (10 caractères minimum)</span>
        <input name="nouveauMotDePasse" type="password" autoComplete="new-password" required className="input h-11" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-neutral-600">Confirmation</span>
        <input name="confirmation" type="password" autoComplete="new-password" required className="input h-11" />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Enregistrement…" : "Changer le mot de passe"}
      </button>
    </form>
  );
}
