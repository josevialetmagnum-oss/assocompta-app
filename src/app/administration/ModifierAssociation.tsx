"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { modifierAssociationAction, type FormState } from "./actions";

// Modification d'une association : son nom, et pour chaque compte trésorier l'email et un nouveau
// mot de passe (laissé vide = inchangé). Le serveur revalide tout.
export function ModifierAssociation({ id, nom, tresoriers }: { id: number; nom: string; tresoriers: { id: number; email: string }[] }) {
  const [ouvert, setOuvert] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(modifierAssociationAction, undefined);
  const etaitEnCours = useRef(false);

  // Referme le panneau quand l'enregistrement vient de réussir.
  useEffect(() => {
    if (pending) {
      etaitEnCours.current = true;
    } else if (etaitEnCours.current) {
      etaitEnCours.current = false;
      if (!state?.errors) setOuvert(false);
    }
  }, [pending, state]);

  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)} className="text-xs font-semibold text-[var(--accent-fonce)] underline">
        Modifier
      </button>
    );
  }

  return (
    <form action={formAction} className="flex w-full max-w-xs flex-col gap-2 rounded border bg-[#F7F9F5] p-3 text-xs">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="tresoriers" value={tresoriers.map((t) => t.id).join(",")} />
      {state?.errors && (
        <div role="alert" className="rounded border border-red-300 bg-red-50 p-2 text-red-700">
          {state.errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-neutral-600">Nom de l&apos;association</span>
        <input name="nom" defaultValue={nom} required className="input h-9" />
      </label>
      {tresoriers.map((t) => (
        <div key={t.id} className="flex flex-col gap-2 border-t pt-2">
          <label className="flex flex-col gap-1">
            <span className="text-neutral-600">Email du trésorier</span>
            <input name={`email_${t.id}`} type="email" defaultValue={t.email} required className="input h-9" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-neutral-600">Nouveau mot de passe (vide = inchangé)</span>
            <input name={`motDePasse_${t.id}`} type="text" minLength={10} autoComplete="off" className="input h-9" />
          </label>
        </div>
      ))}
      <span className="flex gap-3 pt-1">
        <button type="submit" disabled={pending} className="font-semibold text-[var(--accent-fonce)] underline disabled:opacity-50">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button type="button" onClick={() => setOuvert(false)} className="text-[var(--texte-discret)] underline">
          Annuler
        </button>
      </span>
    </form>
  );
}
