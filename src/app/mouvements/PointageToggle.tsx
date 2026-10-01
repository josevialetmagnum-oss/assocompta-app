"use client";

import { useTransition } from "react";
import { basculerPointage } from "./actions";

export function PointageToggle({ id, pointe, verrouille }: { id: number; pointe: boolean; verrouille?: boolean }) {
  const [pending, startTransition] = useTransition();

  if (verrouille) {
    return (
      <span className="rounded-xl bg-[#E3F1E9] px-2.5 py-0.5 text-[13px] font-bold text-[#24603F]" title="Rattaché à un rapprochement validé : dépointable uniquement en supprimant ce rapprochement.">
        Rapproché
      </span>
    );
  }

  return (
    <label className="flex items-center gap-1.5 text-xs">
      <input
        type="checkbox"
        checked={pointe}
        disabled={pending}
        onChange={(e) => startTransition(() => basculerPointage(id, e.target.checked))}
      />
      Pointé
    </label>
  );
}
