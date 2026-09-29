import Link from "next/link";
import { jetonValide } from "@/lib/reinitialisation-mdp";
import { FormulaireReinitialisation } from "./Formulaire";

export const dynamic = "force-dynamic";

export default async function ReinitialiserPage({
  searchParams,
}: {
  searchParams: Promise<{ jeton?: string }>;
}) {
  const { jeton } = await searchParams;
  const valide = !!jeton && (await jetonValide(jeton));

  return (
    <div className="flex w-full flex-col gap-6">
      <h1 className="text-xl font-semibold">Nouveau mot de passe</h1>
      {valide ? (
        <FormulaireReinitialisation jeton={jeton} />
      ) : (
        <div className="flex flex-col items-center gap-3">
          <p className="rounded border border-amber-300 bg-amber-50 p-3 text-center text-sm text-amber-800">
            Ce lien n&apos;est plus valable (expiré ou déjà utilisé).
          </p>
          <Link href="/connexion/mot-de-passe-oublie" className="text-sm underline">
            Refaire une demande
          </Link>
        </div>
      )}
    </div>
  );
}
