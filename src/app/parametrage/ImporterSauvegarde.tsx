"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Resume = { journaux: number; categories: number; sousCategories: number; exercices: number; rapprochements: number; mouvements: number; premiereDate: string | null; derniereDate: string | null };
type Etat = { type: "repos" } | { type: "verifie"; resume: Resume } | { type: "erreurs"; erreurs: string[] } | { type: "importe"; resume: Resume };

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR") : "—");

// Deux temps : « Vérifier » (aucune écriture, affiche ce que contient le fichier), puis « Importer ».
// Le serveur revalide tout à l'import : l'aperçu n'est jamais une autorisation.
export function ImporterSauvegarde() {
  const router = useRouter();
  const champ = useRef<HTMLInputElement>(null);
  const [etat, setEtat] = useState<Etat>({ type: "repos" });
  const [enCours, setEnCours] = useState(false);

  async function envoyer(confirmer: boolean) {
    const fichier = champ.current?.files?.[0];
    if (!fichier) return setEtat({ type: "erreurs", erreurs: ["Choisissez d'abord un fichier de sauvegarde (.json)."] });
    setEnCours(true);
    try {
      const donnees = new FormData();
      donnees.set("fichier", fichier);
      donnees.set("confirmer", confirmer ? "1" : "0");
      const res = await fetch("/parametrage/import", { method: "POST", body: donnees });
      const json = await res.json().catch(() => null);
      if (json?.ok) {
        // Pas de rafraîchissement ici : la page remplacerait aussitôt cette section (l'association n'est plus
        // vide) et le message de réussite disparaîtrait. On rafraîchit quand la personne passe à la suite.
        setEtat(json.applique ? { type: "importe", resume: json.resume } : { type: "verifie", resume: json.resume });
      } else {
        setEtat({ type: "erreurs", erreurs: json?.erreurs ?? ["Réponse inattendue du serveur."] });
      }
    } catch {
      setEtat({ type: "erreurs", erreurs: ["Échec de l'envoi du fichier."] });
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={champ}
          type="file"
          accept=".json,application/json"
          aria-label="Fichier de sauvegarde"
          onChange={() => setEtat({ type: "repos" })}
          className="text-sm"
        />
        <button type="button" disabled={enCours} onClick={() => envoyer(false)} className="rounded border px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
          {enCours ? "Vérification…" : "Vérifier le fichier"}
        </button>
      </div>

      {etat.type === "erreurs" && (
        <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <p className="mb-1 font-semibold">Import impossible :</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {etat.erreurs.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {etat.type === "verifie" && (
        <div className="space-y-2 rounded border border-[#bcd9c6] bg-[#EEF6F0] p-3 text-sm">
          <p className="font-semibold">Fichier valide. Il contient :</p>
          <ul className="list-disc pl-5">
            <li>{etat.resume.journaux} compte(s) et {etat.resume.categories} catégorie(s) ({etat.resume.sousCategories} sous-catégories)</li>
            <li>{etat.resume.exercices} exercice(s), {etat.resume.rapprochements} rapprochement(s)</li>
            <li>{etat.resume.mouvements} mouvement(s) du {fmt(etat.resume.premiereDate)} au {fmt(etat.resume.derniereDate)}</li>
          </ul>
          <p className="text-[var(--texte-discret)]">Ces données seront ajoutées à l&apos;association, qui est vide. Les comptes utilisateurs ne sont pas importés.</p>
          <button type="button" disabled={enCours} onClick={() => envoyer(true)} className="rounded border border-[#24603F] px-3 py-1.5 font-semibold text-[#24603F] disabled:opacity-50">
            {enCours ? "Import en cours…" : "Importer ces données"}
          </button>
        </div>
      )}

      {etat.type === "importe" && (
        <div role="status" className="space-y-2 rounded border border-[#bcd9c6] bg-[#EEF6F0] p-3 text-sm">
          <p className="font-semibold text-[#24603F]">
            Import terminé : {etat.resume.mouvements} mouvement(s), {etat.resume.exercices} exercice(s), {etat.resume.journaux} compte(s).
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={() => router.push("/mouvements")} className="rounded border border-[#24603F] px-3 py-1.5 font-semibold text-[#24603F]">
              Voir les mouvements
            </button>
            <button type="button" onClick={() => router.refresh()} className="rounded border px-3 py-1.5">
              Terminer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
