import Link from "next/link";
import { associationCourante } from "@/lib/association";
import { exerciceActif, situationTresorerie, soldesJournaux } from "@/lib/tresorerie";

export const dynamic = "force-dynamic";

export default async function TableauDeBordPage() {
  const associationId = await associationCourante();
  const [soldes, exercice] = await Promise.all([soldesJournaux(associationId), exerciceActif(associationId)]);
  const situation = exercice ? await situationTresorerie(associationId, exercice.id) : null;

  const fmt = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totalSoldes = Math.round(soldes.reduce((s, j) => s + j.solde, 0) * 100) / 100;

  return (
    <main className="mx-auto max-w-[1180px] space-y-6 px-4 py-6 sm:px-8">
      <div>
        <h1 className="text-[34px] leading-tight font-semibold">Tableau de bord</h1>
        <p className="mt-1 text-base text-[var(--texte-discret)]">
          {exercice ? `Exercice en cours : ${exercice.libelle}` : "Aucun exercice ouvert — commencez par le Paramétrage."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <section className="rounded border p-5">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--texte-discret)]">Trésorerie totale</p>
          <p className="mt-1 text-2xl font-bold">{fmt(totalSoldes)} €</p>
        </section>
        <section className="rounded border p-5">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--texte-discret)]">Recettes ({exercice?.libelle ?? "—"})</p>
          <p className="mt-1 text-2xl font-bold text-[#24603F]">{situation ? fmt(situation.totalRecettes) : "0,00"} €</p>
        </section>
        <section className="rounded border p-5">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--texte-discret)]">Dépenses ({exercice?.libelle ?? "—"})</p>
          <p className="mt-1 text-2xl font-bold text-[#A3231B]">{situation ? fmt(situation.totalDepenses) : "0,00"} €</p>
        </section>
      </div>

      <section className="overflow-x-auto rounded border px-5 py-3">
        <h2 className="mb-2 mt-2 font-sans text-[17px] font-bold tracking-normal">Soldes par compte</h2>
        <table className="w-full max-w-md border-collapse text-[15px]">
          <tbody>
            {soldes.length === 0 && (
              <tr><td className="py-3 text-[var(--texte-discret)]">Aucun journal paramétré.</td></tr>
            )}
            {soldes.map((j) => (
              <tr key={j.journalId} className="border-b">
                <td className="py-2 pr-2">{j.nom}</td>
                <td className="py-2 pr-2 text-right font-semibold">{fmt(j.solde)} €</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="flex gap-4 text-sm font-bold text-[var(--accent)]">
        <Link href="/mouvements">Saisir un mouvement →</Link>
        <Link href="/etats">Voir les états →</Link>
      </div>
    </main>
  );
}
