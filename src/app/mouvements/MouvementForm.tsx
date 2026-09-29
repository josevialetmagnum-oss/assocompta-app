"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { creerMouvement, type FormState } from "./actions";

type Journal = { id: number; nom: string };
type Exercice = { id: number; libelle: string };
type SousCategorie = { id: number; nom: string; categorieNom: string; type: "recette" | "depense" };

export function MouvementForm({
  journaux,
  exercices,
  sousCategories,
}: {
  journaux: Journal[];
  exercices: Exercice[];
  sousCategories: SousCategorie[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(creerMouvement, undefined);
  const [type, setType] = useState<"recette" | "depense" | "virement_interne">("depense");
  const [ventilations, setVentilations] = useState<{ sousCategorieId: string; montant: string }[]>([{ sousCategorieId: "", montant: "" }]);

  const options = useMemo(() => sousCategories.filter((s) => s.type === type), [sousCategories, type]);
  const totalVentile = ventilations.reduce((s, v) => s + (Number(v.montant) || 0), 0);

  // L'action serveur ne renvoie rien en cas de succès (juste `undefined`) : contrairement aux
  // champs non contrôlés du <form>, la ventilation est un état React qui ne se réinitialise pas
  // tout seul après une soumission réussie — sans ceci, les lignes précédentes resteraient
  // affichées (et resoumises par erreur) après l'ajout d'un mouvement.
  const etaitEnCours = useRef(false);
  useEffect(() => {
    if (etaitEnCours.current && !pending && !state) {
      setVentilations([{ sousCategorieId: "", montant: "" }]);
    }
    etaitEnCours.current = pending;
  }, [pending, state]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (type !== "virement_interne") {
          const donnees = ventilations
            .filter((v) => v.sousCategorieId && v.montant)
            .map((v) => ({ sousCategorieId: Number(v.sousCategorieId), montant: Number(v.montant) }));
          const champ = (e.currentTarget.elements.namedItem("ventilations") as HTMLInputElement | null);
          if (champ) champ.value = JSON.stringify(donnees);
        }
      }}
      className="flex flex-col gap-3"
    >
      {state?.errors && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {state.errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}
      <input type="hidden" name="ventilations" />

      <div className="flex flex-wrap gap-3">
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="text-neutral-600">Exercice</span>
          <select name="exerciceId" required className="input h-11">
            {exercices.map((e) => (
              <option key={e.id} value={e.id}>{e.libelle}</option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="text-neutral-600">Journal</span>
          <select name="journalId" required className="input h-11">
            {journaux.map((j) => (
              <option key={j.id} value={j.id}>{j.nom}</option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="text-neutral-600">Date</span>
          <input name="date" type="date" required className="input h-11" />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="text-neutral-600">Type</span>
          <select
            name="type"
            required
            className="input h-11"
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            <option value="depense">Dépense</option>
            <option value="recette">Recette</option>
            <option value="virement_interne">Virement entre comptes</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="text-neutral-600">Mode</span>
          <select name="typeTransaction" required className="input h-11">
            <option value="virement">Virement</option>
            <option value="prelevement">Prélèvement</option>
            <option value="cheque">Chèque</option>
            <option value="especes">Espèces</option>
            <option value="autre">Autre</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="text-neutral-600">Tiers</span>
          <input name="tiers" className="input h-11" />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="text-neutral-600">N° de chèque</span>
          <input name="numeroCheque" className="input h-11" />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="text-neutral-600">N° de facture</span>
          <input name="numeroFacture" className="input h-11" />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          <span className="text-neutral-600">Commentaire</span>
          <input name="commentaire" className="input h-11" />
        </label>
      </div>

      {type === "virement_interne" ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-neutral-600">Compte de destination</span>
            <select name="journalDestinationId" required className="input h-11">
              {journaux.map((j) => (
                <option key={j.id} value={j.id}>{j.nom}</option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-neutral-600">Montant</span>
            <input name="montantVirement" type="number" step="0.01" min="0.01" required className="input h-11" />
          </label>
        </div>
      ) : (
        <div className="space-y-2 rounded border border-dashed p-3">
          <p className="text-sm font-semibold">Ventilation par sous-catégorie</p>
          {ventilations.map((v, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <select
                className="input h-11 min-w-[220px]"
                value={v.sousCategorieId}
                onChange={(e) => {
                  const copie = [...ventilations];
                  copie[i] = { ...copie[i], sousCategorieId: e.target.value };
                  setVentilations(copie);
                }}
              >
                <option value="">Sous-catégorie…</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>{o.categorieNom} — {o.nom}</option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Montant"
                className="input h-11 w-32"
                value={v.montant}
                onChange={(e) => {
                  const copie = [...ventilations];
                  copie[i] = { ...copie[i], montant: e.target.value };
                  setVentilations(copie);
                }}
              />
              {ventilations.length > 1 && (
                <button
                  type="button"
                  onClick={() => setVentilations(ventilations.filter((_, j) => j !== i))}
                  className="text-sm font-semibold text-[#A3231B]"
                >
                  Retirer
                </button>
              )}
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setVentilations([...ventilations, { sousCategorieId: "", montant: "" }])}
              className="text-sm font-bold text-[var(--accent)]"
            >
              + Ajouter une ligne
            </button>
            <span className="text-sm text-[var(--texte-discret)]">Total : {totalVentile.toFixed(2)} €</span>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-11 w-fit rounded-[10px] bg-neutral-900 px-5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Enregistrement…" : "Enregistrer le mouvement"}
      </button>
    </form>
  );
}
