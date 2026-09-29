"use client";

import { useTransition } from "react";
import { basculerPointage } from "./actions";

export function PointageToggle({ id, pointe }: { id: number; pointe: boolean }) {
  const [pending, startTransition] = useTransition();
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
