"use client";

import { useActionState } from "react";
import { creerAssociationAction, type FormState } from "./actions";

export function AssociationForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(creerAssociationAction, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {state?.errors && (
        <div className="w-full rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {state.errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="text-neutral-600">Nom de l&apos;association</span>
        <input name="nom" required className="input h-11" />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="text-neutral-600">Email du trésorier</span>
        <input name="email" type="email" required className="input h-11" />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="text-neutral-600">Mot de passe initial</span>
        <input name="motDePasse" type="text" required minLength={10} className="input h-11" />
      </label>
      <button type="submit" disabled={pending} className="h-11 rounded-[10px] bg-neutral-900 px-4 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? "Création…" : "Créer l'association"}
      </button>
    </form>
  );
}
