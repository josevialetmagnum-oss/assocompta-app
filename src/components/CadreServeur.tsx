import { authConfiguree, session } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { menuPour, peutVoirLeMetier, type ProfilMenu } from "@/lib/navigation";
import { Cadre, type DonneesCadre } from "./Cadre";

// Cadre commun côté serveur : profil de la personne connectée, association courante, menu
// correspondant. Sans session (page de connexion), aucun cadre : la page s'affiche seule.
export async function CadreServeur({ children }: { children: React.ReactNode }) {
  const authentification = authConfiguree();
  const s = authentification ? await session() : null;
  if (authentification && !s) return <>{children}</>;

  const profil: ProfilMenu = { role: s?.role ?? "tresorier", authentification };

  let association: DonneesCadre["association"] = null;
  if (peutVoirLeMetier(profil) && s?.associationId) {
    const a = await prisma.association.findUnique({ where: { id: s.associationId }, select: { nom: true } });
    association = a ? { nom: a.nom } : null;
  }

  const donnees: DonneesCadre = {
    menu: menuPour(profil),
    utilisateur: s ? { email: s.email, role: s.role } : null,
    association,
    lectureSeule: authentification && profil.role === "lecture_seule",
  };

  return <Cadre donnees={donnees}>{children}</Cadre>;
}
