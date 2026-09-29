import { redirect } from "next/navigation";
import { exigerSuperviseur, ConnexionRequise } from "@/lib/association";
import { listerAssociations } from "@/lib/administration";
import { AssociationForm } from "./AssociationForm";
import { BasculeActif } from "./BasculeActif";

export const dynamic = "force-dynamic";

export default async function AdministrationPage() {
  await exigerSuperviseur().catch((e) => redirect(e instanceof ConnexionRequise ? "/connexion" : "/"));
  const associations = await listerAssociations();

  return (
    <main className="mx-auto max-w-[1180px] space-y-6 px-4 py-6 sm:px-8">
      <div>
        <h1 className="text-[34px] leading-tight font-semibold">Associations</h1>
        <p className="mt-1 text-base text-[var(--texte-discret)]">
          Crée une association et son compte trésorier initial. Le trésorier gère ensuite lui-même son
          paramétrage (journaux, catégories, exercices) et les comptes de consultation.
        </p>
      </div>

      <section className="rounded border p-5">
        <AssociationForm />
      </section>

      <section className="overflow-x-auto rounded border px-5 py-3">
        <table className="w-full min-w-[560px] border-collapse text-[15px]">
          <thead>
            <tr className="border-b text-left text-[13px] text-[var(--texte-discret)]">
              <th className="py-2 pr-2 font-semibold">Association</th>
              <th className="py-2 pr-2 font-semibold">Trésorier</th>
              <th className="py-2 pr-2 font-semibold">Statut</th>
              <th className="py-2 pr-2"></th>
            </tr>
          </thead>
          <tbody>
            {associations.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-[var(--texte-discret)]">
                  Aucune association.
                </td>
              </tr>
            )}
            {associations.map((a) => (
              <tr key={a.id} className="border-b align-top">
                <td className="py-3 pr-2 font-semibold">{a.nom}</td>
                <td className="py-3 pr-2">{a.utilisateurs.map((u) => u.email).join(", ") || "—"}</td>
                <td className="py-3 pr-2">
                  {a.actif ? (
                    <span className="rounded-xl bg-[#E3F1E9] px-2.5 py-0.5 text-[13px] font-bold text-[#24603F]">Active</span>
                  ) : (
                    <span className="rounded-xl bg-[#FCEFD9] px-2.5 py-0.5 text-[13px] font-bold text-[#8A4B00]">Suspendue</span>
                  )}
                </td>
                <td className="py-3 pr-2">
                  <BasculeActif id={a.id} actif={a.actif} nom={a.nom} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
