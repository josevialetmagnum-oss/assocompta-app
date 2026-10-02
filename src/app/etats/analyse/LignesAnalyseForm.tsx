"use client";

import { useState } from "react";

export type GroupeOptions = { categorie: string; sousCategories: { id: number; nom: string }[] };
export type LigneSaisie = { rec: string; dep: string };

function Liste({ nom, label, groupes, valeur, onChange }: {
  nom: string;
  label: string;
  groupes: GroupeOptions[];
  valeur: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
      <span className="text-neutral-600">{label}</span>
      <select name={nom} value={valeur} onChange={(e) => onChange(e.target.value)} className="input h-11">
        <option value="">—</option>
        {groupes.map((g) => (
          <optgroup key={g.categorie} label={g.categorie}>
            {g.sousCategories.map((sc) => (
              <option key={sc.id} value={sc.id}>{sc.nom}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

// Formulaire GET : la période et les lignes passent dans l'adresse (du, au, rec, dep répétés, dans le
// même ordre), ce qui rend l'état partageable et rechargeable.
export function LignesAnalyseForm({ du, au, initiales, recettes, depenses }: {
  du: string;
  au: string;
  initiales: LigneSaisie[];
  recettes: GroupeOptions[];
  depenses: GroupeOptions[];
}) {
  const [lignes, setLignes] = useState<(LigneSaisie & { cle: number })[]>(
    (initiales.length ? initiales : [{ rec: "", dep: "" }]).map((l, i) => ({ ...l, cle: i })),
  );
  const [prochaineCle, setProchaineCle] = useState(initiales.length || 1);

  const modifier = (cle: number, champ: "rec" | "dep", v: string) =>
    setLignes((ls) => ls.map((l) => (l.cle === cle ? { ...l, [champ]: v } : l)));

  return (
    <form method="get" className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-600">Du</span>
          <input type="date" name="du" defaultValue={du} required className="input h-11" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-600">Au</span>
          <input type="date" name="au" defaultValue={au} required className="input h-11" />
        </label>
      </div>

      <div className="space-y-3">
        {lignes.map((l, i) => (
          <div key={l.cle} className="flex flex-wrap items-end gap-3">
            <span className="w-6 pb-3 text-sm text-[var(--texte-discret)]">{i + 1}</span>
            <Liste nom="rec" label="Sous-catégorie de recette" groupes={recettes} valeur={l.rec} onChange={(v) => modifier(l.cle, "rec", v)} />
            <Liste nom="dep" label="Sous-catégorie de dépense" groupes={depenses} valeur={l.dep} onChange={(v) => modifier(l.cle, "dep", v)} />
            <button
              type="button"
              onClick={() => setLignes((ls) => (ls.length > 1 ? ls.filter((x) => x.cle !== l.cle) : [{ ...l, rec: "", dep: "" }]))}
              className="h-11 rounded border px-3 text-sm"
              aria-label={`Retirer la ligne ${i + 1}`}
            >
              Retirer
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            setLignes((ls) => [...ls, { rec: "", dep: "", cle: prochaineCle }]);
            setProchaineCle((c) => c + 1);
          }}
          className="rounded border px-3 py-1.5 text-sm"
        >
          Ajouter une ligne
        </button>
        <button type="submit" className="rounded border px-3 py-1.5 text-sm font-semibold">Afficher l&apos;état</button>
      </div>
    </form>
  );
}
