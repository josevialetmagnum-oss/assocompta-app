"use client";

import { useActionState } from "react";
import { creerSousCategorie, type FormState } from "./actions";

export function SousCategorieForm({ categories }: { categories: { id: number; nom: string; type: string }[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(creerSousCategorie, undefined);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {state?.errors && <div className="w-full rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">{state.errors.join(" ")}</div>}
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="text-neutral-600">Catégorie</span>
        <select name="categorieId" required className="input h-11">
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom} ({c.type === "recette" ? "recette" : "dépense"})
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="text-neutral-600">Nom de la sous-catégorie</span>
        <input name="nom" required className="input h-11" />
      </label>
      <button type="submit" disabled={pending} className="h-11 rounded-[10px] bg-neutral-900 px-4 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? "Ajout…" : "Ajouter"}
      </button>
    </form>
  );
}
