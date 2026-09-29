"use client";

import { useActionState } from "react";
import { creerExercice, type FormState } from "./actions";

export function ExerciceForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(creerExercice, undefined);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {state?.errors && <div className="w-full rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">{state.errors.join(" ")}</div>}
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="text-neutral-600">Libellé (ex. 2026, 2026-2027)</span>
        <input name="libelle" required className="input h-11" />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="text-neutral-600">Début</span>
        <input name="dateDebut" type="date" required className="input h-11" />
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="text-neutral-600">Fin</span>
        <input name="dateFin" type="date" required className="input h-11" />
      </label>
      <button type="submit" disabled={pending} className="h-11 rounded-[10px] bg-neutral-900 px-4 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? "Création…" : "Créer l'exercice"}
      </button>
    </form>
  );
}
