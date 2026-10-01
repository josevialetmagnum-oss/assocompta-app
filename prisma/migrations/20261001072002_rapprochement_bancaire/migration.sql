-- AlterTable
ALTER TABLE "Mouvement" ADD COLUMN     "rapprochementId" INTEGER;

-- CreateTable
CREATE TABLE "Rapprochement" (
    "id" SERIAL NOT NULL,
    "associationId" INTEGER NOT NULL,
    "journalId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "solde" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rapprochement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rapprochement_associationId_idx" ON "Rapprochement"("associationId");

-- CreateIndex
CREATE INDEX "Rapprochement_journalId_idx" ON "Rapprochement"("journalId");

-- CreateIndex
CREATE INDEX "Mouvement_rapprochementId_idx" ON "Mouvement"("rapprochementId");

-- AddForeignKey
ALTER TABLE "Rapprochement" ADD CONSTRAINT "Rapprochement_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rapprochement" ADD CONSTRAINT "Rapprochement_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mouvement" ADD CONSTRAINT "Mouvement_rapprochementId_fkey" FOREIGN KEY ("rapprochementId") REFERENCES "Rapprochement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
