"use client";

import { useActionState } from "react";
import { validerRapprochementAction, type FormState } from "./actions";

export function ValiderRapprochementForm({
  journalId,
  date,
  solde,
  ecartNul,
}: {
  journalId: number;
  date: string;
  solde: number;
  ecartNul: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(validerRapprochementAction, undefined);

  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="journalId" value={journalId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="solde" value={solde} />
      {state?.error && <p className="text-sm text-[#A3231B]">{state.error}</p>}
      <button
        type="submit"
        disabled={pending || !ecartNul}
        title={ecartNul ? undefined : "L'écart doit être nul pour valider"}
        className="h-11 rounded-[10px] bg-neutral-900 px-5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Validation…" : "Valider le rapprochement"}
      </button>
    </form>
  );
}
