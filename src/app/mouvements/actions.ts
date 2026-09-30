"use server";

import { revalidatePath } from "next/cache";
import type { TypeMouvement, TypeTransaction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { associationCourante, exigerEcriture } from "@/lib/association";
import { exerciceActif } from "@/lib/tresorerie";
import { calculerDateBilan } from "@/lib/date-bilan";

export type FormState = { errors: string[] } | undefined;

type LigneVentilation = { sousCategorieId: number; montant: number };

const TYPES_MOUVEMENT: TypeMouvement[] = ["recette", "depense", "virement_interne"];
const TYPES_TRANSACTION: TypeTransaction[] = ["virement", "prelevement", "cheque", "especes", "autre"];

export async function creerMouvement(_prevState: FormState, formData: FormData): Promise<FormState> {
  await exigerEcriture();
  const associationId = await associationCourante();

  const exerciceId = Number(formData.get("exerciceId"));
  const journalId = Number(formData.get("journalId"));
  const typeBrut = String(formData.get("type") ?? "");
  const typeTransactionBrut = String(formData.get("typeTransaction") ?? "");
  const dateBrut = String(formData.get("date") ?? "");
  const tiers = String(formData.get("tiers") ?? "").trim() || null;
  const numeroCheque = String(formData.get("numeroCheque") ?? "").trim() || null;
  const numeroFacture = String(formData.get("numeroFacture") ?? "").trim() || null;
  const commentaire = String(formData.get("commentaire") ?? "").trim() || null;
  const journalDestinationId = formData.get("journalDestinationId") ? Number(formData.get("journalDestinationId")) : null;

  if (!dateBrut) return { errors: ["La date est obligatoire."] };
  if (!TYPES_MOUVEMENT.includes(typeBrut as TypeMouvement)) return { errors: ["Type invalide."] };
  if (!TYPES_TRANSACTION.includes(typeTransactionBrut as TypeTransaction)) return { errors: ["Type de transaction invalide."] };
  const type = typeBrut as TypeMouvement;
  const typeTransaction = typeTransactionBrut as TypeTransaction;

  const exercice = await prisma.exercice.findFirst({ where: { id: exerciceId, associationId } });
  if (!exercice) return { errors: ["Exercice introuvable."] };
  if (exercice.cloture) return { errors: ["Cet exercice est clôturé : aucune saisie n'est plus possible."] };

  const journal = await prisma.journal.findFirst({ where: { id: journalId, associationId, actif: true } });
  if (!journal) return { errors: ["Journal introuvable."] };

  const date = new Date(dateBrut);
  const dateBilan = calculerDateBilan(date, exercice, await exerciceActif(associationId));

  if (type === "virement_interne") {
    const montant = Number(formData.get("montantVirement"));
    if (!montant || montant <= 0) return { errors: ["Le montant doit être positif."] };
    if (!journalDestinationId || journalDestinationId === journalId) {
      return { errors: ["Sélectionnez un compte de destination différent du compte source."] };
    }
    const destination = await prisma.journal.findFirst({ where: { id: journalDestinationId, associationId, actif: true } });
    if (!destination) return { errors: ["Compte de destination introuvable."] };

    await prisma.mouvement.create({
      data: {
        associationId, exerciceId, journalId, journalDestinationId, date, dateBilan, type, typeTransaction,
        montant, tiers, numeroCheque, numeroFacture, commentaire,
      },
    });
  } else {
    let ventilations: LigneVentilation[] = [];
    try {
      ventilations = JSON.parse(String(formData.get("ventilations") ?? "[]"));
    } catch {
      ventilations = [];
    }
    if (ventilations.length === 0) return { errors: ["Ajoutez au moins une ligne de ventilation."] };
    if (ventilations.some((v) => !v.sousCategorieId || !(v.montant > 0))) {
      return { errors: ["Chaque ligne de ventilation doit avoir une sous-catégorie et un montant positif."] };
    }
    const sousCategories = await prisma.sousCategorie.findMany({
      where: { id: { in: ventilations.map((v) => v.sousCategorieId) }, categorie: { associationId, type } },
    });
    if (sousCategories.length !== new Set(ventilations.map((v) => v.sousCategorieId)).size) {
      return { errors: ["Une sous-catégorie sélectionnée n'appartient pas à cette association ou à ce type."] };
    }
    const montant = Math.round(ventilations.reduce((s, v) => s + v.montant, 0) * 100) / 100;

    await prisma.mouvement.create({
      data: {
        associationId, exerciceId, journalId, date, dateBilan, type, typeTransaction, montant,
        tiers, numeroCheque, numeroFacture, commentaire,
        ventilations: { create: ventilations.map((v) => ({ sousCategorieId: v.sousCategorieId, montant: v.montant })) },
      },
    });
  }

  revalidatePath("/mouvements");
  revalidatePath("/etats");
  revalidatePath("/");
}

// Une fois rapproché (pointe = true), un mouvement reste modifiable pour tout corriger SAUF ce qui
// a servi au rapprochement bancaire : date, montant et type (recette/dépense/virement). La
// ventilation par sous-catégorie reste modifiable même rapproché, mais son total doit rester égal
// au montant déjà enregistré — jamais fait confiance à ce que le formulaire affichait, revérifié ici.
export async function modifierMouvement(_prevState: FormState, formData: FormData): Promise<FormState> {
  await exigerEcriture();
  const associationId = await associationCourante();
  const id = Number(formData.get("id"));

  const mouvement = await prisma.mouvement.findFirst({ where: { id, associationId }, include: { exercice: true } });
  if (!mouvement) return { errors: ["Mouvement introuvable."] };
  if (mouvement.exercice.cloture) return { errors: ["Cet exercice est clôturé : ce mouvement ne peut plus être modifié."] };

  const journalId = Number(formData.get("journalId"));
  const typeTransactionBrut = String(formData.get("typeTransaction") ?? "");
  const tiers = String(formData.get("tiers") ?? "").trim() || null;
  const numeroCheque = String(formData.get("numeroCheque") ?? "").trim() || null;
  const numeroFacture = String(formData.get("numeroFacture") ?? "").trim() || null;
  const commentaire = String(formData.get("commentaire") ?? "").trim() || null;

  if (!TYPES_TRANSACTION.includes(typeTransactionBrut as TypeTransaction)) return { errors: ["Type de transaction invalide."] };
  const typeTransaction = typeTransactionBrut as TypeTransaction;

  const journal = await prisma.journal.findFirst({ where: { id: journalId, associationId, actif: true } });
  if (!journal) return { errors: ["Journal introuvable."] };

  // Verrouillés une fois rapproché : la date et le type restent ceux déjà enregistrés — et avec eux,
  // la date bilan qui en dérive (voir src/lib/date-bilan.ts) : elle n'est recalculée que si la date
  // de saisie a pu changer, jamais après rapprochement.
  let date = mouvement.date;
  let type: TypeMouvement = mouvement.type;
  let dateBilan: Date | undefined;
  if (!mouvement.pointe) {
    const dateBrut = String(formData.get("date") ?? "");
    const typeBrut = String(formData.get("type") ?? "");
    if (!dateBrut) return { errors: ["La date est obligatoire."] };
    if (!TYPES_MOUVEMENT.includes(typeBrut as TypeMouvement)) return { errors: ["Type invalide."] };
    date = new Date(dateBrut);
    type = typeBrut as TypeMouvement;
    dateBilan = calculerDateBilan(date, mouvement.exercice, await exerciceActif(associationId));
  }

  if (type === "virement_interne") {
    let montant = mouvement.montant;
    if (!mouvement.pointe) {
      montant = Number(formData.get("montantVirement"));
      if (!montant || montant <= 0) return { errors: ["Le montant doit être positif."] };
    }
    const journalDestinationId = formData.get("journalDestinationId") ? Number(formData.get("journalDestinationId")) : null;
    if (!journalDestinationId || journalDestinationId === journalId) {
      return { errors: ["Sélectionnez un compte de destination différent du compte source."] };
    }
    const destination = await prisma.journal.findFirst({ where: { id: journalDestinationId, associationId, actif: true } });
    if (!destination) return { errors: ["Compte de destination introuvable."] };

    await prisma.$transaction(async (tx) => {
      await tx.mouvementVentilation.deleteMany({ where: { mouvementId: id } });
      await tx.mouvement.update({
        where: { id },
        data: { journalId, journalDestinationId, date, dateBilan, type, typeTransaction, montant, tiers, numeroCheque, numeroFacture, commentaire },
      });
    });
  } else {
    let ventilations: LigneVentilation[] = [];
    try {
      ventilations = JSON.parse(String(formData.get("ventilations") ?? "[]"));
    } catch {
      ventilations = [];
    }
    if (ventilations.length === 0) return { errors: ["Ajoutez au moins une ligne de ventilation."] };
    if (ventilations.some((v) => !v.sousCategorieId || !(v.montant > 0))) {
      return { errors: ["Chaque ligne de ventilation doit avoir une sous-catégorie et un montant positif."] };
    }
    const sousCategories = await prisma.sousCategorie.findMany({
      where: { id: { in: ventilations.map((v) => v.sousCategorieId) }, categorie: { associationId, type } },
    });
    if (sousCategories.length !== new Set(ventilations.map((v) => v.sousCategorieId)).size) {
      return { errors: ["Une sous-catégorie sélectionnée n'appartient pas à cette association ou à ce type."] };
    }
    const totalVentile = Math.round(ventilations.reduce((s, v) => s + v.montant, 0) * 100) / 100;
    let montant = totalVentile;
    if (mouvement.pointe) {
      if (Math.abs(totalVentile - mouvement.montant) > 0.01) {
        return { errors: [`Ce mouvement est rapproché : le total des lignes doit rester égal au montant déjà enregistré (${mouvement.montant.toFixed(2)} €).`] };
      }
      montant = mouvement.montant;
    }

    await prisma.$transaction(async (tx) => {
      await tx.mouvementVentilation.deleteMany({ where: { mouvementId: id } });
      await tx.mouvement.update({
        where: { id },
        data: {
          journalId, journalDestinationId: null, date, dateBilan, type, typeTransaction, montant,
          tiers, numeroCheque, numeroFacture, commentaire,
          ventilations: { create: ventilations.map((v) => ({ sousCategorieId: v.sousCategorieId, montant: v.montant })) },
        },
      });
    });
  }

  revalidatePath("/mouvements");
  revalidatePath("/etats");
  revalidatePath("/");
}

export async function basculerPointage(id: number, pointe: boolean): Promise<void> {
  await exigerEcriture();
  const associationId = await associationCourante();
  await prisma.mouvement.updateMany({
    where: { id, associationId },
    data: { pointe, pointeLe: pointe ? new Date() : null },
  });
  revalidatePath("/mouvements");
  revalidatePath("/rapprochement");
}

export async function supprimerMouvement(id: number): Promise<{ error?: string }> {
  await exigerEcriture();
  const associationId = await associationCourante();
  const mouvement = await prisma.mouvement.findFirst({ where: { id, associationId }, include: { exercice: true } });
  if (!mouvement) return { error: "Mouvement introuvable." };
  if (mouvement.exercice.cloture) return { error: "Cet exercice est clôturé : ce mouvement ne peut plus être supprimé." };
  if (mouvement.pointe) return { error: "Ce mouvement est rapproché : il ne peut plus être supprimé (dépointez-le d'abord)." };
  await prisma.mouvement.delete({ where: { id } });
  revalidatePath("/mouvements");
  revalidatePath("/etats");
  revalidatePath("/");
  return {};
}
