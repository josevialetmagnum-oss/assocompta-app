import { prisma } from "@/lib/prisma";
import { associationCourante } from "@/lib/association";
import { exerciceActif, resultatParCategorie, situationTresorerie, soldesJournaux } from "@/lib/tresorerie";

export const dynamic = "force-dynamic";

export default async function EtatsPage({ searchParams }: { searchParams: Promise<{ exercice?: string }> }) {
  const associationId = await associationCourante();
  const sp = await searchParams;

  const [exercices, actif, soldes] = await Promise.all([
    prisma.exercice.findMany({ where: { associationId }, orderBy: { dateDebut: "desc" } }),
    exerciceActif(associationId),
    soldesJournaux(associationId),
  ]);

  const exerciceId = sp.exercice ? Number(sp.exercice) : actif?.id;
  const exercice = exercices.find((e) => e.id === exerciceId);
  const [lignes, situation] = exerciceId
    ? await Promise.all([resultatParCategorie(associationId, exerciceId), situationTresorerie(associationId, exerciceId)])
    : [[], { totalRecettes: 0, totalDepenses: 0, resultat: 0 }];

  const fmt = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totalSoldes = Math.round(soldes.reduce((s, j) => s + j.solde, 0) * 100) / 100;

  return (
    <main className="mx-auto max-w-[1180px] space-y-6 px-4 py-6 sm:px-8">
      <div>
        <h1 className="text-[34px] leading-tight font-semibold">Soldes et résultats</h1>
        <p className="mt-1 text-base text-[var(--texte-discret)]">Situation de trésorerie : pas de bilan comptable normalisé.</p>
      </div>

      <section className="overflow-x-auto rounded border px-5 py-3">
        <h2 className="mb-2 mt-2 font-sans text-[17px] font-bold tracking-normal">Soldes des comptes (temps réel)</h2>
        <table className="w-full max-w-md border-collapse text-[15px]">
          <tbody>
            {soldes.map((j) => (
              <tr key={j.journalId} className="border-b">
                <td className="py-2 pr-2">{j.nom}</td>
                <td className="py-2 pr-2 text-right font-semibold">{fmt(j.solde)} €</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className="py-2 pr-2">Total</td>
              <td className="py-2 pr-2 text-right">{fmt(totalSoldes)} €</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="rounded border p-5">
        <form method="get" className="flex items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-600">Exercice</span>
            <select name="exercice" defaultValue={String(exerciceId ?? "")} className="input h-11">
              {exercices.map((e) => (
                <option key={e.id} value={e.id}>{e.libelle}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded border px-3 py-1.5 text-sm">Afficher</button>
        </form>
      </section>

      {exercice && (
        <>
          <section className="overflow-x-auto rounded border px-5 py-3">
            <h2 className="mb-2 mt-2 font-sans text-[17px] font-bold tracking-normal">Résultat analytique — {exercice.libelle}</h2>
            <table className="w-full max-w-lg border-collapse text-[15px]">
              <thead>
                <tr className="border-b text-left text-[13px] text-[var(--texte-discret)]">
                  <th className="py-2 pr-2 font-semibold">Catégorie</th>
                  <th className="py-2 pr-2 font-semibold">Type</th>
                  <th className="py-2 pr-2 font-semibold">Montant</th>
                </tr>
              </thead>
              <tbody>
                {lignes.length === 0 && (
                  <tr><td colSpan={3} className="py-3 text-[var(--texte-discret)]">Aucun mouvement sur cet exercice.</td></tr>
                )}
                {lignes.map((l) => (
                  <tr key={l.categorieId} className="border-b">
                    <td className="py-2 pr-2">{l.nom}</td>
                    <td className="py-2 pr-2">
                      {l.type === "recette" ? (
                        <span className="rounded-xl bg-[#E3F1E9] px-2.5 py-0.5 text-[13px] font-bold text-[#24603F]">Recette</span>
                      ) : (
                        <span className="rounded-xl bg-[#FBE4E1] px-2.5 py-0.5 text-[13px] font-bold text-[#A3231B]">Dépense</span>
                      )}
                    </td>
                    <td className="py-2 pr-2 font-semibold">{fmt(l.total)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="rounded border px-5 py-4">
            <h2 className="mb-2 font-sans text-[17px] font-bold tracking-normal">Situation de trésorerie — {exercice.libelle}</h2>
            <p className="text-[15px]">Total recettes : <span className="font-semibold">{fmt(situation.totalRecettes)} €</span></p>
            <p className="text-[15px]">Total dépenses : <span className="font-semibold">{fmt(situation.totalDepenses)} €</span></p>
            <p className="text-[15px]">Résultat : <span className="font-bold">{fmt(situation.resultat)} €</span></p>
          </section>
        </>
      )}
    </main>
  );
}
