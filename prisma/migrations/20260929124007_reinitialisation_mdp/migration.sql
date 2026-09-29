-- CreateTable
CREATE TABLE "ReinitialisationMotDePasse" (
    "id" SERIAL NOT NULL,
    "utilisateurId" INTEGER NOT NULL,
    "jetonHash" TEXT NOT NULL,
    "expireLe" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReinitialisationMotDePasse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReinitialisationMotDePasse_jetonHash_key" ON "ReinitialisationMotDePasse"("jetonHash");

-- CreateIndex
CREATE INDEX "ReinitialisationMotDePasse_utilisateurId_idx" ON "ReinitialisationMotDePasse"("utilisateurId");

-- AddForeignKey
ALTER TABLE "ReinitialisationMotDePasse" ADD CONSTRAINT "ReinitialisationMotDePasse_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
