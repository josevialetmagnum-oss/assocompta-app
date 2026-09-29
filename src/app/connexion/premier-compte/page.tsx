import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { authConfiguree } from "@/lib/auth";
import { PremierCompteForm } from "./PremierCompteForm";

export const dynamic = "force-dynamic";

export default async function PremierComptePage() {
  const activee = authConfiguree();
  const cleConfiguree = !!process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const aucunCompte = activee && (await prisma.utilisateur.count()) === 0;

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold">Créer le premier compte</h1>
        <p className="mt-1 text-[15px] text-[var(--texte-discret)]">
          Cette page ne sert qu&apos;une seule fois, tant qu&apos;aucun compte n&apos;existe. Le compte créé ici est le
          superviseur (LBSOFT) : il crée ensuite les comptes des associations depuis l&apos;administration.
        </p>
      </div>

      {!activee ? (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-center text-sm text-amber-800">
          L&apos;authentification n&apos;est pas configurée sur ce serveur (SESSION_SECRET manquante).
        </p>
      ) : !cleConfiguree ? (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-center text-sm text-amber-800">
          La création du premier compte n&apos;est pas activée (BOOTSTRAP_ADMIN_PASSWORD manquante).
        </p>
      ) : !aucunCompte ? (
        <p className="rounded border border-neutral-300 bg-neutral-50 p-3 text-center text-sm text-neutral-700">
          Un compte existe déjà.{" "}
          <Link href="/connexion" className="underline">
            Se connecter →
          </Link>
        </p>
      ) : (
        <PremierCompteForm />
      )}
    </div>
  );
}
