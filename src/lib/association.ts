// Cloisonnement : chaque utilisateur (tresorier/lecture_seule) est rattaché à
// une seule association (Utilisateur.associationId) — pas de structure
// "cabinet" qui en gère plusieurs (décision du 29/09/2026), donc pas de
// sélecteur ni de bascule entre associations comme sur raisins-app.

import { redirect } from "next/navigation";
import { session } from "@/lib/auth";

export class AccesAssociationRefuse extends Error {}
export class EcritureRefusee extends AccesAssociationRefuse {}
export class ConnexionRequise extends Error {}

// À appeler en tête de chaque Server Component métier (mouvements,
// paramétrage, états) : résout l'association de l'utilisateur connecté, ou
// redirige vers la connexion / l'administration si aucune ne s'applique.
export async function associationCourante(): Promise<number> {
  const s = await session();
  if (!s) redirect("/connexion");
  if (!s.associationId) redirect("/administration");
  return s.associationId;
}

// À appeler en tête de chaque action serveur qui ÉCRIT une donnée métier
// (jamais les lectures, ni l'administration ou le compte) : le rôle
// lecture_seule consulte les données de son association sans les modifier.
export async function exigerEcriture(): Promise<void> {
  const s = await session();
  if (!s) throw new ConnexionRequise("Session expirée.");
  if (s.role === "lecture_seule") {
    throw new EcritureRefusee("Ce compte est en lecture seule : il ne peut ni saisir ni modifier de mouvement.");
  }
}

// Superviseur (éditeur de la solution) : gère /administration, jamais les
// données d'une association.
export async function exigerSuperviseur(): Promise<void> {
  const s = await session();
  if (!s) throw new ConnexionRequise("Session expirée.");
  if (s.role !== "superviseur") throw new AccesAssociationRefuse("Réservé au superviseur.");
}
