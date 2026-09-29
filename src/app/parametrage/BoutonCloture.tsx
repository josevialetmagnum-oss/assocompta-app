"use client";

import { useState, useTransition } from "react";
import { cloturerExercice } from "./actions";

export function BoutonCloture({ id, libelle }: { id: number; libelle: string }) {
  const [pending, startTransition] = useTransition();
  const [confirmation, setConfirmation] = useState(false);

  if (!confirmation) {
    return (
      <button type="button" onClick={() => setConfirmation(true)} className="text-xs font-semibold text-[#A3231B] underline">
        Clôturer
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <span className="text-xs text-[#A3231B]">Clôturer {libelle} ? Il redeviendra consultable, plus modifiable.</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => cloturerExercice(id))}
        className="text-xs font-semibold text-[#A3231B] underline"
      >
        Confirmer
      </button>
      <button type="button" onClick={() => setConfirmation(false)} className="text-xs text-[var(--texte-discret)] underline">
        Annuler
      </button>
    </span>
  );
}
