import Link from "next/link";
import { FormulaireMotDePasseOublie } from "./Formulaire";

export const dynamic = "force-dynamic";

export default function MotDePasseOubliePage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <h1 className="text-xl font-semibold">Mot de passe oublié</h1>
      <p className="text-center text-sm text-neutral-600">
        Saisissez l&apos;email de votre compte : vous recevrez un lien pour choisir un nouveau mot de passe.
      </p>
      <FormulaireMotDePasseOublie />
      <Link href="/connexion" className="text-sm text-neutral-500 underline">
        ← Retour à la connexion
      </Link>
    </div>
  );
}
