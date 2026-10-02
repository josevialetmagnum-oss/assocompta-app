"use client";

import { useState, useTransition } from "react";
import { rouvrirExercice } from "./actions";

export function BoutonRouvrir({ id, libelle, suivants }: { id: number; libelle: string; suivants: string[] }) {
  const [pending, startTransition] = useTransition();
  const [confirmation, setConfirmation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  if (!confirmation) {
    return (
      <button type="button" onClick={() => setConfirmation(true)} className="text-xs font-semibold underline">
        Rouvrir
      </button>
    );
  }
  return (
    <div className="flex max-w-md flex-col gap-1.5 text-xs">
      <span className="text-[#A3231B]">
        Rouvrir {libelle} ? Ses soldes figés sont supprimés et seront recalculés à la prochaine clôture.
        {suivants.length > 0 && ` Les exercices suivants déjà clôturés (${suivants.join(", ")}) sont rouverts aussi, car leur ouverture en dépend.`}
      </span>
      {erreur && <span role="alert" className="font-semibold text-[#A3231B]">{erreur}</span>}
      <span className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await rouvrirExercice(id);
              if (res.error) setErreur(res.error);
            })
          }
          className="font-semibold text-[#A3231B] underline"
        >
          Confirmer la réouverture
        </button>
        <button type="button" onClick={() => { setConfirmation(false); setErreur(null); }} className="text-[var(--texte-discret)] underline">
          Annuler
        </button>
      </span>
    </div>
  );
}
