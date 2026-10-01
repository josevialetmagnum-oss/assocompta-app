"use client";

import { useState } from "react";
import { MouvementForm, type MouvementExistant } from "./MouvementForm";
import { PointageToggle } from "./PointageToggle";
import { SupprimerMouvementButton } from "./SupprimerMouvementButton";

type Journal = { id: number; nom: string };
type SousCategorie = { id: number; nom: string; categorieNom: string; type: "recette" | "depense" };

type Mouvement = {
  id: number;
  date: Date;
  dateBilan: Date;
  type: "recette" | "depense" | "virement_interne";
  typeTransaction: string;
  tiers: string | null;
  numeroCheque: string | null;
  numeroFacture: string | null;
  commentaire: string | null;
  montant: number;
  pointe: boolean;
  rapprochementId: number | null;
  journalId: number;
  journal: { nom: string };
  journalDestinationId: number | null;
  journalDestination: { nom: string } | null;
  ventilations: { id: number; sousCategorieId: number; montant: number; sousCategorie: { nom: string; categorie: { nom: string } } }[];
};

export function LigneMouvement({
  mouvement: m,
  journaux,
  sousCategories,
}: {
  mouvement: Mouvement;
  journaux: Journal[];
  sousCategories: SousCategorie[];
}) {
  const [edition, setEdition] = useState(false);
  const fmt = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (edition) {
    const mouvementExistant: MouvementExistant = {
      id: m.id,
      journalId: m.journalId,
      type: m.type,
      typeTransaction: m.typeTransaction,
      date: m.date.toISOString().slice(0, 10),
      tiers: m.tiers ?? "",
      numeroCheque: m.numeroCheque ?? "",
      numeroFacture: m.numeroFacture ?? "",
      commentaire: m.commentaire ?? "",
      montant: m.montant,
      journalDestinationId: m.journalDestinationId,
      ventilations: m.ventilations.map((v) => ({ sousCategorieId: v.sousCategorieId, montant: v.montant })),
      pointe: m.pointe,
    };
    return (
      <tr className="border-b align-top">
        <td colSpan={7} className="py-3">
          <MouvementForm journaux={journaux} exercices={[]} sousCategories={sousCategories} mouvement={mouvementExistant} onSucces={() => setEdition(false)} />
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b align-top">
      <td className="py-3 pr-2">
        {m.date.toLocaleDateString("fr-FR")}
        {m.dateBilan.getTime() !== m.date.getTime() && (
          <div className="text-xs text-[var(--texte-discret)]">Bilan : {m.dateBilan.toLocaleDateString("fr-FR")}</div>
        )}
      </td>
      <td className="py-3 pr-2">
        {m.journal.nom}
        {m.journalDestination && <div className="text-xs text-[var(--texte-discret)]">→ {m.journalDestination.nom}</div>}
      </td>
      <td className="py-3 pr-2">
        {m.type === "recette" && <span className="rounded-xl bg-[#E3F1E9] px-2.5 py-0.5 text-[13px] font-bold text-[#24603F]">Recette</span>}
        {m.type === "depense" && <span className="rounded-xl bg-[#FBE4E1] px-2.5 py-0.5 text-[13px] font-bold text-[#A3231B]">Dépense</span>}
        {m.type === "virement_interne" && <span className="rounded-xl bg-[#DCE8FB] px-2.5 py-0.5 text-[13px] font-bold text-[#163A7A]">Virement</span>}
      </td>
      <td className="py-3 pr-2">
        {m.ventilations.length > 0 ? (
          <ul>
            {m.ventilations.map((v) => (
              <li key={v.id}>{v.sousCategorie.categorie.nom} — {v.sousCategorie.nom} : {fmt(v.montant)} €</li>
            ))}
          </ul>
        ) : (
          "—"
        )}
        {m.tiers && <div className="text-xs text-[var(--texte-discret)]">{m.tiers}</div>}
      </td>
      <td className="py-3 pr-2 font-semibold">{fmt(m.montant)} €</td>
      <td className="py-3 pr-2"><PointageToggle id={m.id} pointe={m.pointe} verrouille={m.rapprochementId !== null} /></td>
      <td className="py-3 pr-2">
        <div className="flex flex-col items-start gap-1">
          <button type="button" onClick={() => setEdition(true)} className="text-xs font-semibold text-[var(--accent)]">
            Modifier
          </button>
          {!m.pointe && <SupprimerMouvementButton id={m.id} />}
        </div>
      </td>
    </tr>
  );
}
