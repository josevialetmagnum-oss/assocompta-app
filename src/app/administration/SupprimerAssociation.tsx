"use client";

import { useState, useTransition } from "react";
import { supprimerAssociationAction } from "./actions";

// Suppression définitive : proposée seulement pour une association bloquée, et il faut retaper son
// nom exact (le serveur revérifie les deux conditions).
export function SupprimerAssociation({ id, nom }: { id: number; nom: string }) {
  const [pending, startTransition] = useTransition();
  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)} className="text-xs font-semibold text-[#A3231B] underline">
        Supprimer
      </button>
    );
  }

  return (
    <div className="flex max-w-xs flex-col gap-1.5 text-xs">
      <span className="font-semibold text-[#A3231B]">
        Supprimer définitivement « {nom} » avec tous ses mouvements, exercices et comptes ? Aucun retour en arrière possible.
      </span>
      <span className="text-[var(--texte-discret)]">
        Vous n&apos;avez pas accès à ses données : si elle en veut une copie, son trésorier peut l&apos;exporter (Paramétrage → Exporter mes données) avant la suppression.
      </span>
      <label className="flex flex-col gap-1">
        <span>Retapez le nom exact pour confirmer :</span>
        <input value={saisie} onChange={(e) => setSaisie(e.target.value)} className="input h-9" autoComplete="off" aria-label="Nom de l'association à supprimer" />
      </label>
      {erreur && <span role="alert" className="font-semibold text-[#A3231B]">{erreur}</span>}
      <span className="flex gap-3">
        <button
          type="button"
          disabled={pending || saisie.trim() !== nom}
          onClick={() =>
            startTransition(async () => {
              const res = await supprimerAssociationAction(id, saisie);
              if (res.error) setErreur(res.error);
            })
          }
          className="font-semibold text-[#A3231B] underline disabled:text-neutral-400 disabled:no-underline"
        >
          Supprimer définitivement
        </button>
        <button type="button" onClick={() => { setOuvert(false); setSaisie(""); setErreur(null); }} className="text-[var(--texte-discret)] underline">
          Annuler
        </button>
      </span>
    </div>
  );
}
