import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { authConfiguree } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string }>;
}) {
  const sp = await searchParams;
  const activee = authConfiguree();
  const aucunCompte = activee && (await prisma.utilisateur.count()) === 0;

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold">Connexion</h1>
        <p className="mt-1 text-[15px] text-[var(--texte-discret)]">Accédez à votre espace AssoCompta.</p>
      </div>

      {!activee ? (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-center text-sm text-amber-800">
          L&apos;authentification n&apos;est pas configurée sur ce serveur : l&apos;application est accessible sans
          connexion.
        </p>
      ) : aucunCompte ? (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-center text-sm text-amber-800">
          Aucun compte n&apos;existe encore.{" "}
          <Link href="/connexion/premier-compte" className="underline">
            Créer le premier compte →
          </Link>
        </p>
      ) : (
        <LoginForm suite={sp.suite ?? "/"} />
      )}
    </div>
  );
}
