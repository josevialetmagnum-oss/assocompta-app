"use client";

import Link from "next/link";
import { useActionSansReinit } from "@/components/useActionSansReinit";
import { reinitialiser, type FormState } from "./actions";

export function FormulaireReinitialisation({ jeton }: { jeton: string }) {
  const { etat: state, enCours: pending, onSubmit, formulaire } = useActionSansReinit<FormState>(reinitialiser, { viderMotsDePasse: true });

  if (state?.termine) {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          Mot de passe modifié. Toutes les sessions ouvertes ont été fermées.
        </p>
        <Link href="/connexion" className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <form ref={formulaire} onSubmit={onSubmit} className="flex w-full flex-col gap-4">
      <input type="hidden" name="jeton" value={jeton} />

      {state?.errors && state.errors.length > 0 && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {state.errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}

      <label className="flex flex-col gap-1 text-[15px]">
        <span className="text-neutral-600">Nouveau mot de passe (10 caractères minimum)</span>
        <input name="nouveauMotDePasse" type="password" autoComplete="new-password" required minLength={10} className="input h-11" />
      </label>
      <label className="flex flex-col gap-1 text-[15px]">
        <span className="text-neutral-600">Confirmation</span>
        <input name="confirmation" type="password" autoComplete="new-password" required minLength={10} className="input h-11" />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-[10px] bg-neutral-900 px-4 text-base font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Enregistrement…" : "Enregistrer le mot de passe"}
      </button>
    </form>
  );
}
