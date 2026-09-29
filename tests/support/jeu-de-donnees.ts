// Jeu de données minimal pour les tests d'intégration : une association, un journal (Caisse), deux
// catégories (une recette, une dépense) avec une sous-catégorie chacune, un exercice ouvert.

import { prisma } from "@/lib/prisma";
import { contexte } from "./contexte";

export type Jeu = {
  associationId: number;
  journalId: number;
  sousCategorieRecette: number;
  sousCategorieDepense: number;
  exerciceId: number;
};

export async function creerJeuComplet(): Promise<Jeu> {
  const association = await prisma.association.create({ data: { nom: "Association test" } });
  contexte.associationId = association.id;

  const journal = await prisma.journal.create({ data: { associationId: association.id, nom: "Caisse" } });

  const categorieRecette = await prisma.categorie.create({
    data: { associationId: association.id, nom: "Cotisations", type: "recette" },
  });
  const sousCategorieRecette = await prisma.sousCategorie.create({
    data: { categorieId: categorieRecette.id, nom: "Cotisations annuelles" },
  });

  const categorieDepense = await prisma.categorie.create({
    data: { associationId: association.id, nom: "Fournitures", type: "depense" },
  });
  const sousCategorieDepense = await prisma.sousCategorie.create({
    data: { categorieId: categorieDepense.id, nom: "Papeterie" },
  });

  const exercice = await prisma.exercice.create({
    data: {
      associationId: association.id,
      libelle: "2026",
      dateDebut: new Date("2026-01-01"),
      dateFin: new Date("2026-12-31"),
    },
  });

  return {
    associationId: association.id,
    journalId: journal.id,
    sousCategorieRecette: sousCategorieRecette.id,
    sousCategorieDepense: sousCategorieDepense.id,
    exerciceId: exercice.id,
  };
}
