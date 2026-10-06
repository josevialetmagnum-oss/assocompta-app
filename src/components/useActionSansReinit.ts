"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from "react";

type Options = {
  // Vide les champs « mot de passe » après chaque envoi, réussi ou non (un mot de passe ne doit pas rester à l'écran).
  viderMotsDePasse?: boolean;
  // Remet le formulaire à son état initial UNIQUEMENT après un succès (formulaire de création qui reste affiché).
  viderApresSucces?: boolean;
};

// Soumission d'un formulaire à une action serveur SANS la réinitialisation automatique de React 19 : celle-ci remet tous les
// champs à leur valeur d'origine après chaque envoi, même en cas d'erreur — la personne perdrait toute sa saisie, et les choix
// pilotés par l'état (boutons radio, listes) se désynchroniseraient de ce qui est affiché. Ici les champs gardent ce qui a été
// saisi ; on ne les vide que lorsque c'est voulu (succès d'une création, mots de passe).
//
// Renvoie : `etat` (résultat de l'action), `enCours`, `onSubmit` et `formulaire` (à poser sur <form ref= onSubmit=>), ainsi que
// `reussites` (nombre de succès, pour réagir à un succès : remettre un état local à zéro).
export function useActionSansReinit<Etat extends object | undefined>(
  action: (precedent: Etat, donnees: FormData) => Promise<Etat>,
  { viderMotsDePasse = false, viderApresSucces = false }: Options = {},
) {
  // Le typage générique d'useActionState (Awaited<…>) est trop strict pour un état qui peut valoir undefined : on le ramène à Etat.
  const [resultat, formAction, enCours] = useActionState<unknown, FormData>(action as unknown as (precedent: unknown, donnees: FormData) => Promise<unknown>, undefined);
  const etat = resultat as Etat;
  const [, demarrer] = useTransition();
  const [reussites, setReussites] = useState(0);
  const formulaire = useRef<HTMLFormElement>(null);
  const etaitEnCours = useRef(false);

  // L'envoi vient de se terminer (l'état et la fin d'attente arrivent ensemble) : on applique ce qui est demandé.
  useEffect(() => {
    if (enCours) {
      etaitEnCours.current = true;
      return;
    }
    if (!etaitEnCours.current) return;
    etaitEnCours.current = false;
    const f = formulaire.current;
    // Succès = pas d'erreur annoncée par l'action (certains états n'ont pas de liste d'erreurs du tout).
    const erreurs = (etat as { errors?: string[] } | undefined)?.errors;
    const reussi = !erreurs || erreurs.length === 0;
    if (f && viderMotsDePasse) f.querySelectorAll<HTMLInputElement>("input[type=password]").forEach((champ) => { champ.value = ""; });
    if (reussi) {
      if (f && viderApresSucces) f.reset();
      setReussites((n) => n + 1);
    }
  }, [enCours, etat, viderMotsDePasse, viderApresSucces]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const donnees = new FormData(e.currentTarget);
    demarrer(() => formAction(donnees));
  };
  return { etat, enCours, onSubmit, formulaire, reussites };
}
