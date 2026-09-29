"use client";

import { useTransition } from "react";
import { basculerActifCompteAction } from "./actions";

export function BasculeActifCompte({ id, actif }: { id: number; actif: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => basculerActifCompteAction(id, !actif))}
      className="text-xs font-semibold text-[var(--accent)] underline disabled:text-neutral-400"
    >
      {actif ? "Désactiver" : "Réactiver"}
    </button>
  );
}
