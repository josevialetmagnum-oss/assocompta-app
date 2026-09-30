import { prisma } from "@/lib/prisma";
import { associationCourante } from "@/lib/association";
import { soldePointeJournal } from "@/lib/tresorerie";
import { PointageToggle } from "@/app/mouvements/PointageToggle";

export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const aujourdHui = () => new Date().toISOString().slice(0, 10);

export default async function RapprochementPage({
  searchParams,
}: {
  searchParams: Promise<{ journal?: string; date?: string; solde?: string }>;
}) {
  const associationId = await associationCourante();
  const sp = await searchParams;

  const journaux = await prisma.journal.findMany({ where: { associationId, actif: true }, orderBy: { nom: "asc" } });

  if (journaux.length === 0) {
    return (
      <main className="mx-auto max-w-[1180px] space-y-6 px-4 py-6 sm:px-8">
        <div>
          <h1 className="text-[34px] leading-tight font-semibold">Rapprochement bancaire</h1>
        </div>
        <section className="rounded border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800">
          Créez d&apos;abord au moins un journal (Paramétrage).
        </section>
      </main>
    );
  }

  const journalId = sp.journal ? Number(sp.journal) : journaux[0].id;
  const journal = journaux.find((j) => j.id === journalId) ?? journaux[0];
  const dateReleveBrut = sp.date || aujourdHui();
  const dateReleve = new Date(dateReleveBrut);
  const soldeReleveBrut = sp.solde?.trim();
  const soldeReleve = soldeReleveBrut ? Number(soldeReleveBrut) : null;

  const [soldePointe, aPointer] = await Promise.all([
    soldePointeJournal(associationId, journal.id, dateReleve),
    prisma.mouvement.findMany({
      where: {
        associationId,
        pointe: false,
        date: { lte: dateReleve },
        OR: [{ journalId: journal.id }, { journalDestinationId: journal.id }],
      },
      include: { journal: true, journalDestination: true, ventilations: { include: { sousCategorie: { include: { categorie: true } } } } },
      orderBy: { date: "asc" },
    }),
  ]);

  const ecart = soldeReleve !== null ? Math.round((soldeReleve - soldePointe) * 100) / 100 : null;

  return (
    <main className="mx-auto max-w-[1180px] space-y-6 px-4 py-6 sm:px-8">
      <div>
        <h1 className="text-[34px] leading-tight font-semibold">Rapprochement bancaire</h1>
        <p className="mt-1 text-base text-[var(--texte-discret)]">
          Compare le solde du relevé à une date donnée avec les mouvements déjà pointés, et liste ceux qui restent à pointer.
        </p>
      </div>

      <section className="rounded border p-5">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-neutral-600">Journal</span>
            <select name="journal" defaultValue={journal.id} className="input h-11">
              {journaux.map((j) => (
                <option key={j.id} value={j.id}>{j.nom}</option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-neutral-600">Date du relevé</span>
            <input type="date" name="date" defaultValue={dateReleveBrut} className="input h-11" />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-neutral-600">Solde du relevé</span>
            <input type="number" step="0.01" name="solde" defaultValue={soldeReleveBrut} placeholder="0,00" className="input h-11 w-36" />
          </label>
          <button type="submit" className="rounded border px-3 py-1.5 text-sm">Afficher</button>
        </form>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded border p-5">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--texte-discret)]">Solde pointé au {dateReleve.toLocaleDateString("fr-FR")}</p>
          <p className="mt-1 text-2xl font-bold">{fmt(soldePointe)} €</p>
        </div>
        <div className="rounded border p-5">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--texte-discret)]">Solde du relevé</p>
          <p className="mt-1 text-2xl font-bold">{soldeReleve !== null ? `${fmt(soldeReleve)} €` : "—"}</p>
        </div>
        <div className="rounded border p-5">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--texte-discret)]">Écart</p>
          {ecart === null ? (
            <p className="mt-1 text-2xl font-bold text-[var(--texte-discret)]">—</p>
          ) : ecart === 0 ? (
            <p className="mt-1 text-2xl font-bold text-[#24603F]">Rapproché ✓</p>
          ) : (
            <p className="mt-1 text-2xl font-bold text-[#A3231B]">{fmt(ecart)} €</p>
          )}
        </div>
      </section>

      <section className="overflow-x-auto rounded border px-5 py-3">
        <h2 className="mb-2 mt-2 font-sans text-[17px] font-bold tracking-normal">
          Mouvements non pointés jusqu&apos;au {dateReleve.toLocaleDateString("fr-FR")}
        </h2>
        <table className="w-full min-w-[700px] border-collapse text-[15px]">
          <thead>
            <tr className="border-b text-left text-[13px] text-[var(--texte-discret)]">
              <th className="py-2 pr-2 font-semibold">Date</th>
              <th className="py-2 pr-2 font-semibold">Type</th>
              <th className="py-2 pr-2 font-semibold">Catégorie / tiers</th>
              <th className="py-2 pr-2 font-semibold">Montant</th>
              <th className="py-2 pr-2 font-semibold">Pointage</th>
            </tr>
          </thead>
          <tbody>
            {aPointer.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-[var(--texte-discret)]">Aucun mouvement en attente de pointage.</td>
              </tr>
            )}
            {aPointer.map((m) => {
              const estDestination = m.journalDestinationId === journal.id;
              return (
                <tr key={m.id} className="border-b align-top">
                  <td className="py-3 pr-2">{m.date.toLocaleDateString("fr-FR")}</td>
                  <td className="py-3 pr-2">
                    {m.type === "recette" && <span className="rounded-xl bg-[#E3F1E9] px-2.5 py-0.5 text-[13px] font-bold text-[#24603F]">Recette</span>}
                    {m.type === "depense" && <span className="rounded-xl bg-[#FBE4E1] px-2.5 py-0.5 text-[13px] font-bold text-[#A3231B]">Dépense</span>}
                    {m.type === "virement_interne" && (
                      <span className="rounded-xl bg-[#DCE8FB] px-2.5 py-0.5 text-[13px] font-bold text-[#163A7A]">
                        Virement {estDestination ? `← ${m.journal.nom}` : `→ ${m.journalDestination?.nom}`}
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-2">
                    {m.ventilations.length > 0 ? (
                      <ul>
                        {m.ventilations.map((v) => (
                          <li key={v.id}>{v.sousCategorie.categorie.nom} — {v.sousCategorie.nom}</li>
                        ))}
                      </ul>
                    ) : (
                      "—"
                    )}
                    {m.tiers && <div className="text-xs text-[var(--texte-discret)]">{m.tiers}</div>}
                  </td>
                  <td className="py-3 pr-2 font-semibold">{fmt(m.montant)} €</td>
                  <td className="py-3 pr-2"><PointageToggle id={m.id} pointe={m.pointe} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
