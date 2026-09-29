// Authentification : cookie httpOnly signé (JWT, jose) plutôt qu'un stockage
// en base, pour rester vérifiable dans le middleware (runtime Edge, sans
// Prisma). Mot de passe : haché avec bcryptjs, jamais stocké ni journalisé en
// clair. Repris du même schéma que raisins-app (LBSOFT).

import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { NOM_COOKIE_SESSION } from "@/lib/session-cookie";

export { NOM_COOKIE_SESSION };
const DUREE_SESSION = "30d";

export class AuthNonConfiguree extends Error {}

function cle(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new AuthNonConfiguree(
      "L'authentification n'est pas configurée : la variable d'environnement SESSION_SECRET est absente.",
    );
  }
  return new TextEncoder().encode(secret);
}

// L'authentification n'est activée (middleware, page de connexion) que si
// SESSION_SECRET est renseignée — une fonctionnalité sensible reste inerte
// tant qu'elle n'a pas été explicitement configurée sur le serveur.
export function authConfiguree(): boolean {
  return !!process.env.SESSION_SECRET;
}

export async function hacherMotDePasse(motDePasse: string): Promise<string> {
  return bcrypt.hash(motDePasse, 12);
}

export async function verifierMotDePasse(motDePasse: string, hash: string): Promise<boolean> {
  return bcrypt.compare(motDePasse, hash);
}

export type SessionUtilisateur = { id: number; email: string; role: string; associationId: number | null };

export async function creerSession(
  utilisateur: SessionUtilisateur & { sessionVersion: number },
): Promise<void> {
  const jeton = await new SignJWT({
    email: utilisateur.email,
    role: utilisateur.role,
    associationId: utilisateur.associationId,
    sv: utilisateur.sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(utilisateur.id))
    .setIssuedAt()
    .setExpirationTime(DUREE_SESSION)
    .sign(cle());

  const magasin = await cookies();
  magasin.set(NOM_COOKIE_SESSION, jeton, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function detruireSession(): Promise<void> {
  const magasin = await cookies();
  magasin.delete(NOM_COOKIE_SESSION);
}

// Utilisable dans les Server Components / Server Actions (via next/headers).
// Le jeton signé ne suffit pas : le compte est relu en base (mis en cache
// pour la durée de la requête) pour qu'une désactivation, un changement de
// rôle ou un mot de passe réinitialisé prennent effet tout de suite, sans
// attendre l'expiration du jeton. Le middleware (runtime Edge, sans base) ne
// vérifie que la signature — voir src/middleware.ts.
export const session = cache(async (): Promise<SessionUtilisateur | null> => {
  if (!authConfiguree()) return null;
  const magasin = await cookies();
  const jeton = magasin.get(NOM_COOKIE_SESSION)?.value;
  if (!jeton) return null;
  try {
    const { payload } = await jwtVerify(jeton, cle());
    const id = Number(payload.sub);
    if (!Number.isInteger(id)) return null;
    const u = await prisma.utilisateur.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, associationId: true, actif: true, sessionVersion: true },
    });
    const versionJeton = typeof payload.sv === "number" ? payload.sv : 0;
    if (!u || !u.actif || u.sessionVersion !== versionJeton) return null;
    return { id: u.id, email: u.email, role: u.role, associationId: u.associationId };
  } catch {
    return null;
  }
});
