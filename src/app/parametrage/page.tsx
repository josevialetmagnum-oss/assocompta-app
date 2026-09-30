import { prisma } from "@/lib/prisma";
import { associationCourante } from "@/lib/association";
import { listerComptesAssociation } from "@/lib/comptes";
import { autoriseSoldesOuverture } from "@/lib/tresorerie";
import { JournalForm } from "./JournalForm";
import { BasculeActifJournal } from "./BasculeActifJournal";
import { CategorieForm } from "./CategorieForm";
import { SousCategorieForm } from "./SousCategorieForm";
import { ExerciceForm } from "./ExerciceForm";
import { BoutonCloture } from "./BoutonCloture";
import { CompteLectureSeuleForm } from "./CompteLectureSeuleForm";
import { BasculeActifCompte } from "./BasculeActifCompte";

export const dynamic = "force-dynamic";

export default async function ParametragePage() {
  // associationCourante() redirige elle-même (connexion / administration) si nécessaire — ne
  // jamais l'envelopper dans un .catch() : cela intercepterait le redirect() de Next.js.
  const associationId = await associationCourante();

  const [journaux, categories, exercices, comptesLectureSeule, soldesOuvertureAutorises] = await Promise.all([
    prisma.journal.findMany({ where: { associationId }, orderBy: { nom: "asc" } }),
    prisma.categorie.findMany({ where: { associationId }, include: { sousCategories: true }, orderBy: [{ type: "asc" }, { nom: "asc" }] }),
    prisma.exercice.findMany({ where: { associationId }, orderBy: { dateDebut: "desc" } }),
    listerComptesAssociation(associationId),
    autoriseSoldesOuverture(associationId),
  ]);

  const fmtDate = (d: Date) => d.toLocaleDateString("fr-FR");

  return (
    <main className="mx-auto max-w-[1180px] space-y-6 px-4 py-6 sm:px-8">
      <div>
        <h1 className="text-[34px] leading-tight font-semibold">Paramétrage</h1>
        <p className="mt-1 text-base text-[var(--texte-discret)]">Journaux, catégories et exercices de l&apos;association.</p>
      </div>

      <section className="space-y-3 rounded border p-5">
        <h2 className="font-sans text-[17px] font-bold tracking-normal">Journaux (caisse, comptes bancaires)</h2>
        <JournalForm />
        <ul className="divide-y">
          {journaux.length === 0 && <li className="py-2 text-sm text-[var(--texte-discret)]">Aucun journal.</li>}
          {journaux.map((j) => (
            <li key={j.id} className="flex items-center justify-between py-2 text-sm">
              <span className={j.actif ? "font-semibold" : "font-semibold text-[var(--texte-discret)] line-through"}>{j.nom}</span>
              <BasculeActifJournal id={j.id} actif={j.actif} />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded border p-5">
        <h2 className="font-sans text-[17px] font-bold tracking-normal">Catégories et sous-catégories</h2>
        <CategorieForm />
        {categories.length > 0 && <SousCategorieForm categories={categories.map((c) => ({ id: c.id, nom: c.nom, type: c.type }))} />}
        <div className="grid gap-4 sm:grid-cols-2">
          {(["recette", "depense"] as const).map((type) => (
            <div key={type}>
              <h3 className="mb-1 text-[13px] font-bold uppercase tracking-wide text-[var(--texte-discret)]">
                {type === "recette" ? "Recettes" : "Dépenses"}
              </h3>
              <ul className="space-y-2">
                {categories.filter((c) => c.type === type).map((c) => (
                  <li key={c.id} className="text-sm">
                    <span className="font-semibold">{c.nom}</span>
                    {c.sousCategories.length > 0 && (
                      <ul className="ml-4 list-disc text-[var(--texte-discret)]">
                        {c.sousCategories.map((sc) => (
                          <li key={sc.id}>{sc.nom}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
                {categories.filter((c) => c.type === type).length === 0 && (
                  <li className="text-sm text-[var(--texte-discret)]">Aucune.</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded border p-5">
        <h2 className="font-sans text-[17px] font-bold tracking-normal">Exercices</h2>
        <ExerciceForm
          journaux={journaux.map((j) => ({ id: j.id, nom: j.nom, soldeInitial: j.soldeInitial }))}
          soldesOuvertureAutorises={soldesOuvertureAutorises}
        />
        <table className="w-full border-collapse text-[15px]">
          <thead>
            <tr className="border-b text-left text-[13px] text-[var(--texte-discret)]">
              <th className="py-2 pr-2 font-semibold">Exercice</th>
              <th className="py-2 pr-2 font-semibold">Période</th>
              <th className="py-2 pr-2 font-semibold">Statut</th>
              <th className="py-2 pr-2"></th>
            </tr>
          </thead>
          <tbody>
            {exercices.length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 text-[var(--texte-discret)]">Aucun exercice.</td>
              </tr>
            )}
            {exercices.map((ex) => (
              <tr key={ex.id} className="border-b">
                <td className="py-3 pr-2 font-semibold">{ex.libelle}</td>
                <td className="py-3 pr-2">{fmtDate(ex.dateDebut)} — {fmtDate(ex.dateFin)}</td>
                <td className="py-3 pr-2">
                  {ex.cloture ? (
                    <span className="rounded-xl bg-[#F0EDE5] px-2.5 py-0.5 text-[13px] font-bold text-[var(--texte-discret)]">Clôturé</span>
                  ) : (
                    <span className="rounded-xl bg-[#E3F1E9] px-2.5 py-0.5 text-[13px] font-bold text-[#24603F]">Ouvert</span>
                  )}
                </td>
                <td className="py-3 pr-2">{!ex.cloture && <BoutonCloture id={ex.id} libelle={ex.libelle} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-3 rounded border p-5">
        <h2 className="font-sans text-[17px] font-bold tracking-normal">Comptes de consultation</h2>
        <p className="text-sm text-[var(--texte-discret)]">
          Accès en lecture seule aux mouvements et aux états (président, commissaire aux comptes...) — jamais de saisie.
        </p>
        <CompteLectureSeuleForm />
        <ul className="divide-y">
          {comptesLectureSeule.length === 0 && <li className="py-2 text-sm text-[var(--texte-discret)]">Aucun compte de consultation.</li>}
          {comptesLectureSeule.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2 text-sm">
              <span className={c.actif ? "font-semibold" : "font-semibold text-[var(--texte-discret)] line-through"}>{c.email}</span>
              <BasculeActifCompte id={c.id} actif={c.actif} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
