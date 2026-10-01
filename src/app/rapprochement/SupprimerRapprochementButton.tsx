"use client";

import { useState, useTransition } from "react";
import { supprimerDernierRapprochementAction } from "./actions";

// Confirmation en deux clics (pas de window.confirm — voir raisins-app pour la raison) : supprimer
// le dernier rapprochement dépointe tous les mouvements qui y étaient rattachés.
export function SupprimerRapprochementButton({ journalId }: { journalId: number }) {
  const [pending, startTransition] = useTransition();
  const [confirmation, setConfirmation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  if (!confirmation) {
    return (
      <button type="button" onClick={() => setConfirmation(true)} className="text-sm font-semibold text-[#A3231B]">
        Supprimer ce rapprochement
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-[#A3231B]">Les mouvements rattachés seront dépointés. Confirmer ?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setErreur(null);
          startTransition(async () => {
            const res = await supprimerDernierRapprochementAction(journalId);
            if (res.error) {
              setErreur(res.error);
              setConfirmation(false);
            }
          });
        }}
        className="text-sm font-semibold text-[#A3231B] underline disabled:text-neutral-400"
      >
        Confirmer
      </button>
      <button type="button" onClick={() => setConfirmation(false)} className="text-sm text-[var(--texte-discret)]">
        Annuler
      </button>
      {erreur && <p className="text-sm text-[#A3231B]">{erreur}</p>}
    </div>
  );
}
