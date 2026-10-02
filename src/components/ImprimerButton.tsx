"use client";

export function ImprimerButton() {
  return (
    <button type="button" onClick={() => window.print()} className="no-print rounded border px-3 py-1.5 text-sm">
      Imprimer l&apos;état
    </button>
  );
}
