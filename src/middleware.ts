// Protège toutes les pages par une session (voir src/lib/auth.ts). Tourne en
// runtime Edge (pas de Prisma ici) : le jeton est vérifié directement avec
// jose, comme à sa création côté serveur.
//
// Inerte tant que SESSION_SECRET n'est pas configurée sur le serveur, pour ne
// jamais verrouiller l'application par surprise.
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { NOM_COOKIE_SESSION } from "@/lib/session-cookie";

export async function middleware(request: NextRequest) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return NextResponse.next();

  const jeton = request.cookies.get(NOM_COOKIE_SESSION)?.value;
  if (jeton) {
    try {
      const { payload } = await jwtVerify(jeton, new TextEncoder().encode(secret));
      // Le superviseur (éditeur de la solution) n'a aucun accès aux données
      // d'une association — seulement à l'administration (création des
      // comptes association) et à son propre compte.
      const pageAutoriseeSuperviseur =
        request.nextUrl.pathname === "/" ||
        request.nextUrl.pathname.startsWith("/administration") ||
        request.nextUrl.pathname.startsWith("/compte");
      if (payload.role === "superviseur" && !pageAutoriseeSuperviseur) {
        return NextResponse.redirect(new URL("/administration", request.url));
      }
      if (request.nextUrl.pathname.startsWith("/administration") && payload.role !== "superviseur") {
        return NextResponse.redirect(new URL("/", request.url));
      }
      return NextResponse.next();
    } catch {
      // Jeton invalide ou expiré : on retombe sur la redirection ci-dessous.
    }
  }

  const url = new URL("/connexion", request.url);
  if (request.nextUrl.pathname !== "/") url.searchParams.set("suite", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|lbsoft-logo.png|connexion).*)"],
};
