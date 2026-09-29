import { prisma } from "@/lib/prisma";
import { associationCourante } from "@/lib/association";
import { exerciceActif } from "@/lib/tresorerie";
import { MouvementForm } from "./MouvementForm";
import { PointageToggle } from "./PointageToggle";
import { SupprimerMouvementButton } from "./SupprimerMouvementButton";

export const dynamic = "force-dynamic";

export default async function MouvementsPage({
  searchParams,
}: {
  searchParams: Promise<{ journal?: string; exercice?: string }>;
}) {
  const associationId = await associationCourante();
  const sp = await searchParams;

  const [journaux, categories, exercices, actif] = await Promise.all([
    prisma.journal.findMany({ where: { associationId, actif: true }, orderBy: { nom: "asc" } }),
    prisma.categorie.findMany({ where: { associationId, actif: true }, include: { sousCategories: { where: { actif: true } } } }),
    prisma.exercice.findMany({ where: { associationId }, orderBy: { dateDebut: "desc" } }),
    exerciceActif(associationId),
  ]);

  const sousCategories = categories.flatMap((c) =>
    c.sousCategories.map((sc) => ({ id: sc.id, nom: sc.nom, categorieNom: c.nom, type: c.type as "recette" | "depense" })),
  );
  const exercicesOuverts = exercices.filter((e) => !e.cloture);

  const journalFiltre = sp.journal ? Number(sp.journal) : undefined;
  const exerciceFiltre = sp.exercice ? Number(sp.exercice) : actif?.id;

  const mouvements = await prisma.mouvement.findMany({
    where: {
      associationId,
      ...(journalFiltre ? { journalId: journalFiltre } : {}),
      ...(exerciceFiltre ? { exerciceId: exerciceFiltre } : {}),
    },
    include: { journal: true, journalDestination: true, ventilations: { include: { sousCategorie: { include: { categorie: true } } } } },
    orderBy: { date: "desc" },
  });

  const fmt = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <main className="mx-auto max-w-[1180px] space-y-6 px-4 py-6 sm:px-8">
      <div>
        <h1 className="text-[34px] leading-tight font-semibold">Mouvements</h1>
        <p className="mt-1 text-base text-[var(--texte-discret)]">Saisie des recettes, dépenses et virements entre comptes.</p>
      </div>

      {journaux.length === 0 || exercicesOuverts.length === 0 ? (
        <section className="rounded border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800">
          {journaux.length === 0 && <p>Créez d&apos;abord au moins un journal (Paramétrage).</p>}
          {exercicesOuverts.length === 0 && <p>Créez d&apos;abord un exercice ouvert (Paramétrage).</p>}
        </section>
      ) : (
        <section className="rounded border p-5">
          <h2 className="mb-3 font-sans text-[17px] font-bold tracking-normal">Nouveau mouvement</h2>
          <MouvementForm
            journaux={journaux}
            exercices={exercicesOuverts.map((e) => ({ id: e.id, libelle: e.libelle }))}
            sousCategories={sousCategories}
          />
        </section>
      )}

      <section className="rounded border p-5">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-neutral-600">Journal</span>
            <select name="journal" defaultValue={sp.journal ?? ""} className="input h-11">
              <option value="">Tous</option>
              {journaux.map((j) => (
                <option key={j.id} value={j.id}>{j.nom}</option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-neutral-600">Exercice</span>
            <select name="exercice" defaultValue={sp.exercice ?? String(exerciceFiltre ?? "")} className="input h-11">
              <option value="">Tous</option>
              {exercices.map((e) => (
                <option key={e.id} value={e.id}>{e.libelle}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded border px-3 py-1.5 text-sm">Filtrer</button>
        </form>
      </section>

      <section className="overflow-x-auto rounded border px-5 py-3">
        <table className="w-full min-w-[800px] border-collapse text-[15px]">
          <thead>
            <tr className="border-b text-left text-[13px] text-[var(--texte-discret)]">
              <th className="py-2 pr-2 font-semibold">Date</th>
              <th className="py-2 pr-2 font-semibold">Journal</th>
              <th className="py-2 pr-2 font-semibold">Type</th>
              <th className="py-2 pr-2 font-semibold">Catégorie / tiers</th>
              <th className="py-2 pr-2 font-semibold">Montant</th>
              <th className="py-2 pr-2 font-semibold">Pointage</th>
              <th className="py-2 pr-2"></th>
            </tr>
          </thead>
          <tbody>
            {mouvements.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-[var(--texte-discret)]">Aucun mouvement.</td>
              </tr>
            )}
            {mouvements.map((m) => (
              <tr key={m.id} className="border-b align-top">
                <td className="py-3 pr-2">{m.date.toLocaleDateString("fr-FR")}</td>
                <td className="py-3 pr-2">
                  {m.journal.nom}
                  {m.journalDestination && <div className="text-xs text-[var(--texte-discret)]">→ {m.journalDestination.nom}</div>}
                </td>
                <td className="py-3 pr-2">
                  {m.type === "recette" && <span className="rounded-xl bg-[#E3F1E9] px-2.5 py-0.5 text-[13px] font-bold text-[#24603F]">Recette</span>}
                  {m.type === "depense" && <span className="rounded-xl bg-[#FBE4E1] px-2.5 py-0.5 text-[13px] font-bold text-[#A3231B]">Dépense</span>}
                  {m.type === "virement_interne" && <span className="rounded-xl bg-[#DCE8FB] px-2.5 py-0.5 text-[13px] font-bold text-[#163A7A]">Virement</span>}
                </td>
                <td className="py-3 pr-2">
                  {m.ventilations.length > 0 ? (
                    <ul>
                      {m.ventilations.map((v) => (
                        <li key={v.id}>{v.sousCategorie.categorie.nom} — {v.sousCategorie.nom} : {fmt(v.montant)} €</li>
                      ))}
                    </ul>
                  ) : (
                    "—"
                  )}
                  {m.tiers && <div className="text-xs text-[var(--texte-discret)]">{m.tiers}</div>}
                </td>
                <td className="py-3 pr-2 font-semibold">{fmt(m.montant)} €</td>
                <td className="py-3 pr-2"><PointageToggle id={m.id} pointe={m.pointe} /></td>
                <td className="py-3 pr-2"><SupprimerMouvementButton id={m.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
