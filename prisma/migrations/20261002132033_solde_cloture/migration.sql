-- CreateTable
CREATE TABLE "SoldeCloture" (
    "id" SERIAL NOT NULL,
    "exerciceId" INTEGER NOT NULL,
    "journalId" INTEGER NOT NULL,
    "solde" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SoldeCloture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SoldeCloture_journalId_idx" ON "SoldeCloture"("journalId");

-- CreateIndex
CREATE UNIQUE INDEX "SoldeCloture_exerciceId_journalId_key" ON "SoldeCloture"("exerciceId", "journalId");

-- AddForeignKey
ALTER TABLE "SoldeCloture" ADD CONSTRAINT "SoldeCloture_exerciceId_fkey" FOREIGN KEY ("exerciceId") REFERENCES "Exercice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoldeCloture" ADD CONSTRAINT "SoldeCloture_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
