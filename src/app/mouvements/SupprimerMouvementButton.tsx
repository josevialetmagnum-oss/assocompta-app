"use client";

import { useState, useTransition } from "react";
import { supprimerMouvement } from "./actions";

// Confirmation en deux clics (pas de window.confirm — voir raisins-app pour la raison : certains
// navigateurs/extensions le bloquent silencieusement, rendant le bouton inopérant sans message).
export function SupprimerMouvementButton({ id }: { id: number }) {
  const [pending, startTransition] = useTransition();
  const [confirmation, setConfirmation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  if (!confirmation) {
    return (
      <button type="button" onClick={() => setConfirmation(true)} className="text-xs font-semibold text-[#A3231B]">
        Supprimer
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setErreur(null);
          startTransition(async () => {
            const res = await supprimerMouvement(id);
            if (res.error) {
              setErreur(res.error);
              setConfirmation(false);
            }
          });
        }}
        className="text-xs font-semibold text-[#A3231B] disabled:text-neutral-400"
      >
        Confirmer ?
      </button>
      <button type="button" onClick={() => setConfirmation(false)} className="text-xs text-[var(--texte-discret)]">
        Annuler
      </button>
      {erreur && <p className="text-xs text-[#A3231B]">{erreur}</p>}
    </div>
  );
}
