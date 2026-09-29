// « Mot de passe oublié » : la personne saisit son email, reçoit un lien à usage unique valable
// une heure, et choisit un nouveau mot de passe.
//
// Sécurité :
//  - le jeton (32 octets aléatoires) n'est jamais stocké : seul son SHA-256 l'est ;
//  - la réponse à la demande est toujours la même, que l'email existe ou non (pas d'énumération) ;
//  - au plus MAX_DEMANDES demandes par compte et par heure (anti-harcèlement par email) ;
//  - le lien pointe vers SITE_URL (jamais vers l'en-tête Host de la requête, falsifiable) ;
//  - un nouveau mot de passe ferme toutes les sessions ouvertes (sessionVersion) et invalide
//    tous les autres jetons du compte.

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hacherMotDePasse } from "@/lib/auth";
import { envoyerEmailPlateforme } from "@/lib/email";

const DUREE_JETON_MS = 60 * 60 * 1000;
const MAX_DEMANDES = 3;
export const LONGUEUR_MIN_MOT_DE_PASSE = 10;

function hacher(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

function urlSite(): string {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL) return "https://assocompta-app.vercel.app";
  return "http://localhost:3010";
}

// Ne révèle jamais si l'email existe : l'appelant affiche le même message dans tous les cas.
export async function demanderReinitialisation(emailBrut: string): Promise<void> {
  const email = emailBrut.trim().toLowerCase();
  if (!email) return;
  const u = await prisma.utilisateur.findUnique({ where: { email } });
  if (!u || !u.actif) return;

  await prisma.reinitialisationMotDePasse.deleteMany({ where: { utilisateurId: u.id, expireLe: { lt: new Date() } } });
  const uneHeure = new Date(Date.now() - 60 * 60 * 1000);
  const recentes = await prisma.reinitialisationMotDePasse.count({ where: { utilisateurId: u.id, createdAt: { gt: uneHeure } } });
  if (recentes >= MAX_DEMANDES) return;

  const jeton = randomBytes(32).toString("hex");
  const creee = await prisma.reinitialisationMotDePasse.create({
    data: { utilisateurId: u.id, jetonHash: hacher(jeton), expireLe: new Date(Date.now() + DUREE_JETON_MS) },
  });

  const lien = `${urlSite()}/connexion/reinitialiser?jeton=${jeton}`;
  try {
    await envoyerEmailPlateforme({
      to: u.email,
      subject: "Réinitialisation de votre mot de passe AssoCompta",
      text: `Bonjour,\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure, à usage unique) :\n${lien}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe reste inchangé.`,
      html: `<p>Bonjour,</p><p>Pour choisir un nouveau mot de passe, cliquez sur ce lien (valable 1 heure, à usage unique) :</p><p><a href="${lien}">${lien}</a></p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe reste inchangé.</p>`,
    });
  } catch (e) {
    // Envoi impossible (SMTP absent ou en erreur) : la demande est retirée sans rien révéler à la
    // personne. Le superviseur peut toujours créer/désactiver un compte, à défaut de réinitialiser
    // lui-même un mot de passe (pas d'écran dédié pour l'instant).
    await prisma.reinitialisationMotDePasse.delete({ where: { id: creee.id } }).catch(() => {});
    console.error("Mot de passe oublié : email non envoyé —", e instanceof Error ? e.message : e);
  }
}

export async function jetonValide(jeton: string): Promise<boolean> {
  if (!jeton) return false;
  const r = await prisma.reinitialisationMotDePasse.findUnique({
    where: { jetonHash: hacher(jeton) },
    include: { utilisateur: { select: { actif: true } } },
  });
  return !!r && r.expireLe > new Date() && r.utilisateur.actif;
}

export type ResultatReinitialisation = { ok: true } | { ok: false; erreur: string };

export async function appliquerReinitialisation(jeton: string, nouveau: string, confirmation: string): Promise<ResultatReinitialisation> {
  if (nouveau.length < LONGUEUR_MIN_MOT_DE_PASSE) {
    return { ok: false, erreur: `Le mot de passe doit contenir au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.` };
  }
  if (nouveau !== confirmation) return { ok: false, erreur: "Les deux mots de passe ne correspondent pas." };

  const invalide: ResultatReinitialisation = { ok: false, erreur: "Ce lien n'est plus valable. Refaites une demande." };
  const r = await prisma.reinitialisationMotDePasse.findUnique({
    where: { jetonHash: hacher(jeton) },
    include: { utilisateur: { select: { id: true, actif: true, email: true } } },
  });
  if (!r || r.expireLe <= new Date() || !r.utilisateur.actif) return invalide;

  // Usage unique : la suppression du jeton conditionne la modification (deux requêtes simultanées
  // avec le même lien : une seule passe).
  const consomme = await prisma.reinitialisationMotDePasse.deleteMany({ where: { id: r.id } });
  if (consomme.count !== 1) return invalide;

  await prisma.$transaction([
    prisma.utilisateur.update({
      where: { id: r.utilisateurId },
      data: { motDePasseHash: await hacherMotDePasse(nouveau), sessionVersion: { increment: 1 } },
    }),
    prisma.reinitialisationMotDePasse.deleteMany({ where: { utilisateurId: r.utilisateurId } }),
  ]);
  return { ok: true };
}
