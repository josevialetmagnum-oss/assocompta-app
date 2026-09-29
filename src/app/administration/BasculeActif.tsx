"use client";

import { useState, useTransition } from "react";
import { basculerActif } from "./actions";

export function BasculeActif({ id, actif, nom }: { id: number; actif: boolean; nom: string }) {
  const [pending, startTransition] = useTransition();
  const [confirmation, setConfirmation] = useState(false);

  if (!actif) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => basculerActif(id, true))}
        className="text-xs font-semibold text-[var(--accent)] underline"
      >
        Réactiver
      </button>
    );
  }

  if (!confirmation) {
    return (
      <button type="button" onClick={() => setConfirmation(true)} className="text-xs font-semibold text-[#A3231B] underline">
        Suspendre
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-[#A3231B]">Suspendre « {nom} » ? Plus personne ne pourra y accéder.</span>
      <span className="flex gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => basculerActif(id, false))}
          className="text-xs text-[#A3231B] underline"
        >
          Confirmer la suspension
        </button>
        <button type="button" onClick={() => setConfirmation(false)} className="text-xs text-[var(--texte-discret)] underline">
          Annuler
        </button>
      </span>
    </div>
  );
}
