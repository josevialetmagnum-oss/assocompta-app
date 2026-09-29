"use client";

import { useActionState } from "react";
import { creerPremierCompte, type FormState } from "./actions";

export function PremierCompteForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(creerPremierCompte, undefined);

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      {state?.errors && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {state.errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}

      <label className="flex flex-col gap-1 text-[15px]">
        <span className="text-neutral-600">Clé de démarrage</span>
        <input name="cleDemarrage" type="password" autoComplete="off" required className="input h-11" />
      </label>

      <label className="flex flex-col gap-1 text-[15px]">
        <span className="text-neutral-600">Email</span>
        <input name="email" type="email" autoComplete="username" required className="input h-11" />
      </label>

      <label className="flex flex-col gap-1 text-[15px]">
        <span className="text-neutral-600">Mot de passe (10 caractères minimum)</span>
        <input name="motDePasse" type="password" autoComplete="new-password" required className="input h-11" />
      </label>

      <label className="flex flex-col gap-1 text-[15px]">
        <span className="text-neutral-600">Confirmation</span>
        <input name="confirmation" type="password" autoComplete="new-password" required className="input h-11" />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-[10px] bg-neutral-900 px-4 text-base font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Création…" : "Créer le compte"}
      </button>
    </form>
  );
}
