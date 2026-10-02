import { prisma } from "@/lib/prisma";
import { associationCourante } from "@/lib/association";
import { exerciceActif } from "@/lib/tresorerie";
import { analyseParLignes } from "@/lib/analyse";
import { lireParametresAnalyse, type ParametresAnalyseBruts } from "@/lib/analyse-params";
import { ImprimerButton } from "@/components/ImprimerButton";
import { LignesAnalyseForm, type GroupeOptions } from "./LignesAnalyseForm";

export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export default async function AnalysePage({
  searchParams,
}: {
  searchParams: Promise<ParametresAnalyseBruts>;
}) {
  const associationId = await associationCourante();
  const sp = await searchParams;

  const [association, categories, actif] = await Promise.all([
    prisma.association.findUniqueOrThrow({ where: { id: associationId } }),
    prisma.categorie.findMany({
      where: { associationId },
      include: { sousCategories: { orderBy: { nom: "asc" } } },
      orderBy: { nom: "asc" },
    }),
    exerciceActif(associationId),
  ]);

  const groupes = (type: "recette" | "depense"): GroupeOptions[] =>
    categories
      .filter((c) => c.type === type && c.sousCategories.length > 0)
      .map((c) => ({ categorie: c.nom, sousCategories: c.sousCategories.map((sc) => ({ id: sc.id, nom: sc.nom })) }));

  const { du, au, saisies, demandees, periodeInvalide } = lireParametresAnalyse(sp, actif);
  const lienPdf = `/etats/analyse/pdf?${new URLSearchParams([["du", du], ["au", au], ...saisies.flatMap((l) => [["rec", l.rec], ["dep", l.dep]])]).toString()}`;

  const resultat = saisies.length > 0 && !periodeInvalide ? await analyseParLignes(associationId, new Date(du), new Date(au), demandees) : null;

  return (
    <main className="mx-auto max-w-[1180px] space-y-6 px-4 py-6 sm:px-8">
      <div className="no-print">
        <h1 className="text-[34px] leading-tight font-semibold">Analyse par lignes</h1>
        <p className="mt-1 text-base text-[var(--texte-discret)]">
          Composez vos lignes (une sous-catégorie de recette et/ou de dépense par ligne) et choisissez une période : chaque ligne affiche
          ses recettes, ses dépenses et leur différence. La période porte sur la date bilan des mouvements.
        </p>
      </div>

      <section className="no-print rounded border p-5">
        <LignesAnalyseForm du={du} au={au} initiales={saisies} recettes={groupes("recette")} depenses={groupes("depense")} />
      </section>

      {periodeInvalide && (
        <section className="rounded border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800">
          La date de fin doit être postérieure ou égale à la date de début.
        </section>
      )}

      {resultat && (
        <section className="table-impression-conteneur overflow-x-auto rounded border px-5 py-3">
          <div className="apercu-impression mb-4">
            <p className="text-[13px] text-[var(--texte-discret)]">{association.nom}</p>
            <h1 className="text-2xl font-semibold">Analyse par lignes</h1>
            <p className="text-[13px] text-[var(--texte-discret)]">Édité le {new Date().toLocaleDateString("fr-FR")}</p>
          </div>
          <div className="mb-2 mt-2 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-sans text-[17px] font-bold tracking-normal">
              Du {new Date(du).toLocaleDateString("fr-FR")} au {new Date(au).toLocaleDateString("fr-FR")}
            </h2>
            <div className="no-print flex flex-wrap gap-2">
              <a href={lienPdf} download className="rounded border px-3 py-1.5 text-sm">Télécharger en PDF</a>
              <ImprimerButton />
            </div>
          </div>
          {resultat.doublons.length > 0 && (
            <p className="mb-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Attention : {resultat.doublons.join(", ")} apparaît sur plusieurs lignes, son montant est compté à chaque fois dans le total.
            </p>
          )}
          <table className="table-impression w-full min-w-[760px] border-collapse text-[15px]">
            <thead>
              <tr className="border-b text-left text-[13px] text-[var(--texte-discret)]">
                <th className="py-2 pr-2 font-semibold">Recette</th>
                <th className="py-2 pr-2 text-right font-semibold">Montant</th>
                <th className="py-2 pr-2 font-semibold">Dépense</th>
                <th className="py-2 pr-2 text-right font-semibold">Montant</th>
                <th className="py-2 pr-2 text-right font-semibold">Différence</th>
              </tr>
            </thead>
            <tbody>
              {resultat.lignes.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-[var(--texte-discret)]">Choisissez au moins une sous-catégorie.</td></tr>
              )}
              {resultat.lignes.map((l, i) => (
                <tr key={i} className="border-b">
                  <td className="py-2 pr-2">{l.recette?.libelle ?? "—"}</td>
                  <td className="py-2 pr-2 text-right">{l.recette ? `${fmt(l.recette.total)} €` : ""}</td>
                  <td className="py-2 pr-2">{l.depense?.libelle ?? "—"}</td>
                  <td className="py-2 pr-2 text-right">{l.depense ? `${fmt(l.depense.total)} €` : ""}</td>
                  <td className="py-2 pr-2 text-right font-semibold">{fmt(l.difference)} €</td>
                </tr>
              ))}
              {resultat.lignes.length > 0 && (
                <tr className="font-bold">
                  <td className="py-3 pr-2">Total recettes</td>
                  <td className="py-3 pr-2 text-right">{fmt(resultat.totalRecettes)} €</td>
                  <td className="py-3 pr-2">Total dépenses</td>
                  <td className="py-3 pr-2 text-right">{fmt(resultat.totalDepenses)} €</td>
                  <td className="py-3 pr-2 text-right">{fmt(resultat.difference)} €</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
