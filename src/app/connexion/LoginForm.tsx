"use client";

import { useActionState } from "react";
import { connecter, type FormState } from "./actions";

export function LoginForm({ suite }: { suite: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(connecter, undefined);

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <input type="hidden" name="suite" value={suite} />

      {state?.errors && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {state.errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}

      <label className="flex flex-col gap-1 text-[15px]">
        <span className="text-neutral-600">Email</span>
        <input name="email" type="email" autoComplete="username" required autoFocus className="input h-11" />
      </label>

      <label className="flex flex-col gap-1 text-[15px]">
        <span className="text-neutral-600">Mot de passe</span>
        <input name="motDePasse" type="password" autoComplete="current-password" required className="input h-11" />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-[10px] bg-neutral-900 px-4 text-base font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
