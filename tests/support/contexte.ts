// Association « courante » et rôle des tests d'intégration : remplace la résolution par session de
// src/lib/association.ts (voir vi.mock("@/lib/association") dans chaque fichier de test).
export const contexte = { associationId: 0, lectureSeule: false };

export function moduleAssociationDeTest() {
  class AccesAssociationRefuse extends Error {}
  class EcritureRefusee extends AccesAssociationRefuse {}
  class ConnexionRequise extends Error {}
  return {
    associationCourante: async () => contexte.associationId,
    exigerEcriture: async () => {
      if (contexte.lectureSeule) throw new EcritureRefusee("Lecture seule.");
    },
    exigerSuperviseur: async () => {},
    AccesAssociationRefuse,
    EcritureRefusee,
    ConnexionRequise,
  };
}
