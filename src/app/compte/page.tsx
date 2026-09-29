import { redirect } from "next/navigation";
import { session } from "@/lib/auth";
import { LIBELLE_ROLE } from "@/lib/navigation";
import { ChangerMotDePasseForm } from "./ChangerMotDePasseForm";

export const dynamic = "force-dynamic";

export default async function ComptePage() {
  const s = await session();
  if (!s) redirect("/connexion");

  return (
    <main className="mx-auto max-w-[1180px] space-y-6 px-4 py-6 sm:px-8">
      <div>
        <h1 className="text-[34px] leading-tight font-semibold">Mon compte</h1>
        <p className="mt-1 text-base text-[var(--texte-discret)]">
          {s.email} — {LIBELLE_ROLE[s.role] ?? s.role}
        </p>
      </div>

      <section className="rounded border p-5">
        <h2 className="mb-3 font-sans text-[17px] font-bold tracking-normal">Changer le mot de passe</h2>
        <ChangerMotDePasseForm />
      </section>
    </main>
  );
}
