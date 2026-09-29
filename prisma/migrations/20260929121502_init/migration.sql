-- CreateEnum
CREATE TYPE "RoleUtilisateur" AS ENUM ('superviseur', 'tresorier', 'lecture_seule');

-- CreateEnum
CREATE TYPE "TypeMouvement" AS ENUM ('recette', 'depense', 'virement_interne');

-- CreateEnum
CREATE TYPE "TypeTransaction" AS ENUM ('virement', 'prelevement', 'cheque', 'especes', 'autre');

-- CreateTable
CREATE TABLE "Association" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Association_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Utilisateur" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "motDePasseHash" TEXT NOT NULL,
    "role" "RoleUtilisateur" NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "associationId" INTEGER,

    CONSTRAINT "Utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercice" (
    "id" SERIAL NOT NULL,
    "associationId" INTEGER NOT NULL,
    "libelle" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "cloture" BOOLEAN NOT NULL DEFAULT false,
    "clotureLe" TIMESTAMP(3),

    CONSTRAINT "Exercice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Journal" (
    "id" SERIAL NOT NULL,
    "associationId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Journal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categorie" (
    "id" SERIAL NOT NULL,
    "associationId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "type" "TypeMouvement" NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Categorie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SousCategorie" (
    "id" SERIAL NOT NULL,
    "categorieId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SousCategorie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mouvement" (
    "id" SERIAL NOT NULL,
    "associationId" INTEGER NOT NULL,
    "exerciceId" INTEGER NOT NULL,
    "journalId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "TypeMouvement" NOT NULL,
    "typeTransaction" "TypeTransaction" NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "tiers" TEXT,
    "numeroCheque" TEXT,
    "numeroFacture" TEXT,
    "commentaire" TEXT,
    "journalDestinationId" INTEGER,
    "pointe" BOOLEAN NOT NULL DEFAULT false,
    "pointeLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mouvement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MouvementVentilation" (
    "id" SERIAL NOT NULL,
    "mouvementId" INTEGER NOT NULL,
    "sousCategorieId" INTEGER NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "MouvementVentilation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_email_key" ON "Utilisateur"("email");

-- CreateIndex
CREATE INDEX "Utilisateur_associationId_idx" ON "Utilisateur"("associationId");

-- CreateIndex
CREATE INDEX "Exercice_associationId_idx" ON "Exercice"("associationId");

-- CreateIndex
CREATE UNIQUE INDEX "Exercice_associationId_libelle_key" ON "Exercice"("associationId", "libelle");

-- CreateIndex
CREATE INDEX "Journal_associationId_idx" ON "Journal"("associationId");

-- CreateIndex
CREATE UNIQUE INDEX "Journal_associationId_nom_key" ON "Journal"("associationId", "nom");

-- CreateIndex
CREATE INDEX "Categorie_associationId_idx" ON "Categorie"("associationId");

-- CreateIndex
CREATE UNIQUE INDEX "Categorie_associationId_nom_type_key" ON "Categorie"("associationId", "nom", "type");

-- CreateIndex
CREATE UNIQUE INDEX "SousCategorie_categorieId_nom_key" ON "SousCategorie"("categorieId", "nom");

-- CreateIndex
CREATE INDEX "Mouvement_associationId_idx" ON "Mouvement"("associationId");

-- CreateIndex
CREATE INDEX "Mouvement_journalId_idx" ON "Mouvement"("journalId");

-- CreateIndex
CREATE INDEX "Mouvement_exerciceId_idx" ON "Mouvement"("exerciceId");

-- CreateIndex
CREATE INDEX "MouvementVentilation_mouvementId_idx" ON "MouvementVentilation"("mouvementId");

-- CreateIndex
CREATE INDEX "MouvementVentilation_sousCategorieId_idx" ON "MouvementVentilation"("sousCategorieId");

-- AddForeignKey
ALTER TABLE "Utilisateur" ADD CONSTRAINT "Utilisateur_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercice" ADD CONSTRAINT "Exercice_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categorie" ADD CONSTRAINT "Categorie_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SousCategorie" ADD CONSTRAINT "SousCategorie_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "Categorie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mouvement" ADD CONSTRAINT "Mouvement_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mouvement" ADD CONSTRAINT "Mouvement_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "Exercice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mouvement" ADD CONSTRAINT "Mouvement_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mouvement" ADD CONSTRAINT "Mouvement_journalDestinationId_fkey" FOREIGN KEY ("journalDestinationId") REFERENCES "Journal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementVentilation" ADD CONSTRAINT "MouvementVentilation_mouvementId_fkey" FOREIGN KEY ("mouvementId") REFERENCES "Mouvement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementVentilation" ADD CONSTRAINT "MouvementVentilation_sousCategorieId_fkey" FOREIGN KEY ("sousCategorieId") REFERENCES "SousCategorie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
