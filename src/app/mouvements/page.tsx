import { prisma } from "@/lib/prisma";
import { associationCourante } from "@/lib/association";
import { exerciceActif } from "@/lib/tresorerie";
import { MouvementForm } from "./MouvementForm";
import { LigneMouvement } from "./LigneMouvement";

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
              <LigneMouvement key={m.id} mouvement={m} journaux={journaux} sousCategories={sousCategories} />
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
