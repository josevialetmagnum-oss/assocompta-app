import { prisma } from "@/lib/prisma";
import { associationCourante } from "@/lib/association";
import { exerciceActif } from "@/lib/tresorerie";
import { bilanExercice, type BlocBilan } from "@/lib/bilan";
import { ImprimerButton } from "@/components/ImprimerButton";
import { EnTeteImpression } from "@/components/EnTeteImpression";

export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const jour = (d: Date) => d.toLocaleDateString("fr-FR");

function Bloc({ titre, bloc, vide }: { titre: string; bloc: BlocBilan; vide: string }) {
  return (
    <>
      <tr className="bg-[#EEF3EC]">
        <th colSpan={2} className="py-2 pl-2 pr-2 text-left text-[15px] font-bold">{titre}</th>
      </tr>
      {bloc.categories.length === 0 && (
        <tr><td colSpan={2} className="py-3 pl-2 text-[var(--texte-discret)]">{vide}</td></tr>
      )}
      {bloc.categories.map((c) => (
        <FragmentCategorie key={c.id} nom={c.nom} total={c.total} sousCategories={c.sousCategories} />
      ))}
      <tr className="border-t-2 font-bold">
        <td className="py-2 pl-2 pr-2">Total {titre.toLowerCase()}</td>
        <td className="py-2 pr-2 text-right">{fmt(bloc.total)} €</td>
      </tr>
    </>
  );
}

function FragmentCategorie({ nom, total, sousCategories }: { nom: string; total: number; sousCategories: { id: number; nom: string; total: number }[] }) {
  return (
    <>
      <tr className="border-b font-semibold">
        <td className="py-2 pl-2 pr-2">{nom}</td>
        <td className="py-2 pr-2 text-right">{fmt(total)} €</td>
      </tr>
      {sousCategories.map((sc) => (
        <tr key={sc.id} className="border-b text-[14px]">
          <td className="py-1.5 pl-8 pr-2">{sc.nom}</td>
          <td className="py-1.5 pr-2 text-right">{fmt(sc.total)} €</td>
        </tr>
      ))}
    </>
  );
}

export default async function BilanPage({ searchParams }: { searchParams: Promise<{ exercice?: string }> }) {
  const associationId = await associationCourante();
  const sp = await searchParams;

  const [association, exercices, actif] = await Promise.all([
    prisma.association.findUniqueOrThrow({ where: { id: associationId } }),
    prisma.exercice.findMany({ where: { associationId }, orderBy: { dateDebut: "desc" } }),
    exerciceActif(associationId),
  ]);

  const demande = sp.exercice ? Number(sp.exercice) : actif?.id;
  const choisi = exercices.find((e) => e.id === demande) ?? exercices[0];
  const bilan = choisi ? await bilanExercice(associationId, choisi.id) : null;

  return (
    <main className="mx-auto max-w-[900px] space-y-6 px-4 py-6 sm:px-8">
      <div className="no-print">
        <h1 className="text-[34px] leading-tight font-semibold">Bilan</h1>
        <p className="mt-1 text-base text-[var(--texte-discret)]">
          Situation de trésorerie d&apos;un exercice : recettes et dépenses par catégorie et sous-catégorie, résultat, soldes des comptes.
        </p>
      </div>

      {exercices.length === 0 && (
        <section className="rounded border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800">
          Créez d&apos;abord un exercice (Paramétrage).
        </section>
      )}

      {choisi && (
        <section className="no-print rounded border p-5">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-600">Exercice</span>
              <select name="exercice" defaultValue={String(choisi.id)} className="input h-11">
                {exercices.map((e) => (
                  <option key={e.id} value={e.id}>{e.libelle}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="rounded border px-3 py-1.5 text-sm">Afficher</button>
          </form>
        </section>
      )}

      {bilan && (
        <section className="table-impression-conteneur overflow-x-auto rounded border px-5 py-3">
          <EnTeteImpression association={association.nom} titre={`Bilan — ${bilan.exercice.libelle}`} />

          <div className="mb-3 mt-2 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-sans text-[17px] font-bold tracking-normal">
              {bilan.exercice.libelle} — du {jour(bilan.exercice.dateDebut)} au {jour(bilan.exercice.dateFin)}
              {bilan.exercice.cloture ? ` (clôturé${bilan.exercice.clotureLe ? ` le ${jour(bilan.exercice.clotureLe)}` : ""})` : ""}
            </h2>
            <div className="no-print flex flex-wrap gap-2">
              <a href={`/etats/bilan/pdf?exercice=${bilan.exercice.id}`} download className="rounded border px-3 py-1.5 text-sm">Télécharger en PDF</a>
              <ImprimerButton />
            </div>
          </div>

          <table className="table-impression w-full border-collapse text-[15px]">
            <tbody>
              <Bloc titre="Recettes" bloc={bilan.recettes} vide="Aucune recette sur cet exercice." />
              <tr><td colSpan={2} className="py-2" /></tr>
              <Bloc titre="Dépenses" bloc={bilan.depenses} vide="Aucune dépense sur cet exercice." />
              <tr><td colSpan={2} className="py-2" /></tr>
              <tr className="border-y-2 text-[16px] font-bold">
                <td className="py-3 pl-2 pr-2">{bilan.resultat >= 0 ? "Résultat de l'exercice (excédent)" : "Résultat de l'exercice (déficit)"}</td>
                <td className="py-3 pr-2 text-right">{fmt(bilan.resultat)} €</td>
              </tr>
            </tbody>
          </table>

          <h3 className="mb-2 mt-8 font-sans text-[16px] font-bold tracking-normal">Situation de trésorerie</h3>
          <table className="table-impression w-full border-collapse text-[15px]">
            <thead>
              <tr className="border-b text-left text-[13px] text-[var(--texte-discret)]">
                <th className="py-2 pl-2 pr-2 font-semibold">Compte</th>
                <th className="py-2 pr-2 text-right font-semibold">Ouverture</th>
                <th className="py-2 pr-2 text-right font-semibold">Variation</th>
                <th className="py-2 pr-2 text-right font-semibold">Clôture</th>
              </tr>
            </thead>
            <tbody>
              {bilan.comptes.map((c) => (
                <tr key={c.journalId} className="border-b">
                  <td className="py-2 pl-2 pr-2">{c.nom}</td>
                  <td className="py-2 pr-2 text-right">{fmt(c.ouverture)} €</td>
                  <td className="py-2 pr-2 text-right">{fmt(c.variation)} €</td>
                  <td className="py-2 pr-2 text-right font-semibold">{fmt(c.cloture)} €</td>
                </tr>
              ))}
              <tr className="border-t-2 font-bold">
                <td className="py-2 pl-2 pr-2">Total</td>
                <td className="py-2 pr-2 text-right">{fmt(bilan.totalOuverture)} €</td>
                <td className="py-2 pr-2 text-right">{fmt(bilan.totalVariation)} €</td>
                <td className="py-2 pr-2 text-right">{fmt(bilan.totalCloture)} €</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
