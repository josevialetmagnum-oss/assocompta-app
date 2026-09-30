"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { creerMouvement, modifierMouvement, type FormState } from "./actions";

type Journal = { id: number; nom: string };
type Exercice = { id: number; libelle: string };
type SousCategorie = { id: number; nom: string; categorieNom: string; type: "recette" | "depense" };
type LigneVentilationExistante = { sousCategorieId: number; montant: number };

export type MouvementExistant = {
  id: number;
  journalId: number;
  type: "recette" | "depense" | "virement_interne";
  typeTransaction: string;
  date: string; // yyyy-mm-dd
  tiers: string;
  numeroCheque: string;
  numeroFacture: string;
  commentaire: string;
  montant: number;
  journalDestinationId: number | null;
  ventilations: LigneVentilationExistante[];
  pointe: boolean;
};

export function MouvementForm({
  journaux,
  exercices,
  exerciceActifId,
  sousCategories,
  mouvement,
  onSucces,
}: {
  journaux: Journal[];
  exercices: Exercice[];
  // Présélectionné dans le sélecteur d'exercice (création seulement) : sans lui, le navigateur
  // choisirait le premier de la liste, qui n'est pas forcément l'exercice en cours.
  exerciceActifId?: number;
  sousCategories: SousCategorie[];
  // En mode modification : verrouille date/montant/type si le mouvement est déjà rapproché (voir
  // modifierMouvement, src/app/mouvements/actions.ts).
  mouvement?: MouvementExistant;
  onSucces?: () => void;
}) {
  const action = mouvement ? modifierMouvement : creerMouvement;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const [type, setType] = useState<"recette" | "depense" | "virement_interne">(mouvement?.type ?? "depense");
  const [ventilations, setVentilations] = useState<{ sousCategorieId: string; montant: string }[]>(
    mouvement && mouvement.ventilations.length > 0
      ? mouvement.ventilations.map((v) => ({ sousCategorieId: String(v.sousCategorieId), montant: String(v.montant) }))
      : [{ sousCategorieId: "", montant: "" }],
  );
  const verrouille = mouvement?.pointe ?? false;

  const options = useMemo(() => sousCategories.filter((s) => s.type === type), [sousCategories, type]);
  const totalVentile = ventilations.reduce((s, v) => s + (Number(v.montant) || 0), 0);

  // L'action serveur ne renvoie rien en cas de succès (juste `undefined`) : contrairement aux
  // champs non contrôlés du <form>, la ventilation est un état React qui ne se réinitialise pas
  // tout seul après une soumission réussie — sans ceci, les lignes précédentes resteraient
  // affichées (et resoumises par erreur) après l'ajout d'un mouvement.
  const etaitEnCours = useRef(false);
  useEffect(() => {
    if (etaitEnCours.current && !pending && !state) {
      if (mouvement) {
        onSucces?.();
      } else {
        setVentilations([{ sousCategorieId: "", montant: "" }]);
      }
    }
    etaitEnCours.current = pending;
  }, [pending, state, mouvement, onSucces]);

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
      {mouvement && <input type="hidden" name="id" value={mouvement.id} />}

      {verrouille && (
        <p className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
          Ce mouvement est rapproché : la date, le montant et le type ne sont plus modifiables (dépointez-le d&apos;abord si besoin).
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        {!mouvement && (
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-neutral-600">Exercice</span>
            <select name="exerciceId" required defaultValue={exerciceActifId} className="input h-11">
              {exercices.map((e) => (
                <option key={e.id} value={e.id}>{e.libelle}</option>
              ))}
            </select>
          </label>
        )}
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="text-neutral-600">Journal</span>
          <select name="journalId" required defaultValue={mouvement?.journalId} className="input h-11">
            {journaux.map((j) => (
              <option key={j.id} value={j.id}>{j.nom}</option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="text-neutral-600">Date</span>
          <input name="date" type="date" required disabled={verrouille} defaultValue={mouvement?.date} className="input h-11 disabled:opacity-60" />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="text-neutral-600">Type</span>
          <select
            name="type"
            required
            disabled={verrouille}
            className="input h-11 disabled:opacity-60"
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
          <select name="typeTransaction" required defaultValue={mouvement?.typeTransaction} className="input h-11">
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
          <input name="tiers" defaultValue={mouvement?.tiers} className="input h-11" />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="text-neutral-600">N° de chèque</span>
          <input name="numeroCheque" defaultValue={mouvement?.numeroCheque} className="input h-11" />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="text-neutral-600">N° de facture</span>
          <input name="numeroFacture" defaultValue={mouvement?.numeroFacture} className="input h-11" />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          <span className="text-neutral-600">Commentaire</span>
          <input name="commentaire" defaultValue={mouvement?.commentaire} className="input h-11" />
        </label>
      </div>

      {type === "virement_interne" ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-neutral-600">Compte de destination</span>
            <select name="journalDestinationId" required defaultValue={mouvement?.journalDestinationId ?? undefined} className="input h-11">
              {journaux.map((j) => (
                <option key={j.id} value={j.id}>{j.nom}</option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-neutral-600">Montant</span>
            <input
              name="montantVirement"
              type="number"
              step="0.01"
              min="0.01"
              required
              disabled={verrouille}
              defaultValue={mouvement?.montant}
              className="input h-11 disabled:opacity-60"
            />
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
            <span className="text-sm text-[var(--texte-discret)]">
              Total : {totalVentile.toFixed(2)} €{verrouille && ` (doit rester égal à ${mouvement!.montant.toFixed(2)} €)`}
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-11 w-fit rounded-[10px] bg-neutral-900 px-5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Enregistrement…" : mouvement ? "Enregistrer les modifications" : "Enregistrer le mouvement"}
        </button>
        {mouvement && (
          <button type="button" onClick={onSucces} className="text-sm text-[var(--texte-discret)]">
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}
