"use client";

import { useState } from "react";
import { creerExercice, type FormState } from "./actions";
import { useActionSansReinit } from "@/components/useActionSansReinit";

type Journal = { id: number; nom: string; soldeInitial: number };

export function ExerciceForm({
  journaux,
  soldesOuvertureAutorises,
}: {
  journaux: Journal[];
  soldesOuvertureAutorises: boolean;
}) {
  const { etat: state, enCours: pending, onSubmit, formulaire } = useActionSansReinit<FormState>(creerExercice, { viderApresSucces: true });
  const [soldes, setSoldes] = useState<Record<number, string>>(() =>
    Object.fromEntries(journaux.map((j) => [j.id, j.soldeInitial ? String(j.soldeInitial) : ""])),
  );

  return (
    <form
      ref={formulaire}
      onSubmit={(e) => {
        const donnees = Object.entries(soldes)
          .filter(([, v]) => v !== "")
          .map(([journalId, v]) => ({ journalId: Number(journalId), solde: Number(v) }));
        const champ = e.currentTarget.elements.namedItem("soldesOuverture") as HTMLInputElement | null;
        if (champ) champ.value = JSON.stringify(donnees);
        onSubmit(e);
      }}
      className="flex flex-col gap-3"
    >
      {state?.errors && <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">{state.errors.join(" ")}</div>}
      <input type="hidden" name="soldesOuverture" />

      <div className="flex flex-wrap items-end gap-3">
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
      </div>

      {soldesOuvertureAutorises && journaux.length > 0 && (
        <div className="space-y-2 rounded border border-dashed p-3">
          <p className="text-sm font-semibold">Solde de départ des comptes</p>
          <p className="text-xs text-[var(--texte-discret)]">
            Aucun mouvement n&apos;a encore été saisi : à remplir si l&apos;association reprend un compte déjà existant
            (sinon laisser à 0). Cette saisie ne sera plus proposée une fois le premier mouvement enregistré.
          </p>
          <div className="flex flex-wrap gap-3">
            {journaux.map((j) => (
              <label key={j.id} className="flex min-w-0 flex-col gap-1 text-sm">
                <span className="text-neutral-600">{j.nom}</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  className="input h-11 w-36"
                  value={soldes[j.id] ?? ""}
                  onChange={(e) => setSoldes({ ...soldes, [j.id]: e.target.value })}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <button type="submit" disabled={pending} className="h-11 w-fit rounded-[10px] bg-neutral-900 px-4 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? "Création…" : "Créer l'exercice"}
      </button>
    </form>
  );
}
