"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { associationCourante, exigerEcriture } from "@/lib/association";
import { basculerActifCompte, creerCompteLectureSeule } from "@/lib/comptes";

export type FormState = { errors: string[] } | undefined;

export async function creerCompteLectureSeuleAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  await exigerEcriture();
  const associationId = await associationCourante();
  const email = String(formData.get("email") ?? "");
  const motDePasse = String(formData.get("motDePasse") ?? "");
  try {
    await creerCompteLectureSeule(associationId, email, motDePasse);
  } catch (e) {
    return { errors: [e instanceof Error ? e.message : "Erreur inattendue."] };
  }
  revalidatePath("/parametrage");
}

export async function basculerActifCompteAction(id: number, actif: boolean): Promise<void> {
  await exigerEcriture();
  const associationId = await associationCourante();
  await basculerActifCompte(id, associationId, actif);
  revalidatePath("/parametrage");
}

export async function creerJournal(_prevState: FormState, formData: FormData): Promise<FormState> {
  await exigerEcriture();
  const associationId = await associationCourante();
  const nom = String(formData.get("nom") ?? "").trim();
  if (!nom) return { errors: ["Le nom est obligatoire."] };
  if (await prisma.journal.findUnique({ where: { associationId_nom: { associationId, nom } } })) {
    return { errors: ["Un journal porte déjà ce nom."] };
  }
  await prisma.journal.create({ data: { associationId, nom } });
  revalidatePath("/parametrage");
}

export async function basculerActifJournal(id: number, actif: boolean): Promise<void> {
  await exigerEcriture();
  const associationId = await associationCourante();
  await prisma.journal.updateMany({ where: { id, associationId }, data: { actif } });
  revalidatePath("/parametrage");
}

export async function creerCategorie(_prevState: FormState, formData: FormData): Promise<FormState> {
  await exigerEcriture();
  const associationId = await associationCourante();
  const nom = String(formData.get("nom") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  if (!nom) return { errors: ["Le nom est obligatoire."] };
  if (type !== "recette" && type !== "depense") return { errors: ["Type invalide."] };
  if (await prisma.categorie.findUnique({ where: { associationId_nom_type: { associationId, nom, type } } })) {
    return { errors: ["Une catégorie porte déjà ce nom pour ce type."] };
  }
  await prisma.categorie.create({ data: { associationId, nom, type } });
  revalidatePath("/parametrage");
}

export async function creerSousCategorie(_prevState: FormState, formData: FormData): Promise<FormState> {
  await exigerEcriture();
  const associationId = await associationCourante();
  const categorieId = Number(formData.get("categorieId"));
  const nom = String(formData.get("nom") ?? "").trim();
  if (!nom) return { errors: ["Le nom est obligatoire."] };
  const categorie = await prisma.categorie.findFirst({ where: { id: categorieId, associationId } });
  if (!categorie) return { errors: ["Catégorie introuvable."] };
  if (await prisma.sousCategorie.findUnique({ where: { categorieId_nom: { categorieId, nom } } })) {
    return { errors: ["Une sous-catégorie porte déjà ce nom."] };
  }
  await prisma.sousCategorie.create({ data: { categorieId, nom } });
  revalidatePath("/parametrage");
}

export async function creerExercice(_prevState: FormState, formData: FormData): Promise<FormState> {
  await exigerEcriture();
  const associationId = await associationCourante();
  const libelle = String(formData.get("libelle") ?? "").trim();
  const dateDebutBrut = String(formData.get("dateDebut") ?? "");
  const dateFinBrut = String(formData.get("dateFin") ?? "");
  if (!libelle || !dateDebutBrut || !dateFinBrut) return { errors: ["Tous les champs sont obligatoires."] };
  const dateDebut = new Date(dateDebutBrut);
  const dateFin = new Date(dateFinBrut);
  if (dateFin <= dateDebut) return { errors: ["La date de fin doit être postérieure à la date de début."] };
  if (await prisma.exercice.findUnique({ where: { associationId_libelle: { associationId, libelle } } })) {
    return { errors: ["Un exercice porte déjà ce libellé."] };
  }
  await prisma.exercice.create({ data: { associationId, libelle, dateDebut, dateFin } });
  revalidatePath("/parametrage");
}

export async function cloturerExercice(id: number): Promise<void> {
  await exigerEcriture();
  const associationId = await associationCourante();
  await prisma.exercice.updateMany({ where: { id, associationId }, data: { cloture: true, clotureLe: new Date() } });
  revalidatePath("/parametrage");
}
