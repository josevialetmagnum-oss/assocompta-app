-- Ajout compatible avec les lignes déjà en production : colonne nullable, remplie sur l'existant
-- avec la date de saisie (choix neutre — on ne peut pas reconstituer rétroactivement quel exercice
-- était "en cours" au moment de chaque saisie passée), puis rendue obligatoire.
ALTER TABLE "Mouvement" ADD COLUMN "dateBilan" TIMESTAMP(3);

UPDATE "Mouvement" SET "dateBilan" = "date" WHERE "dateBilan" IS NULL;

ALTER TABLE "Mouvement" ALTER COLUMN "dateBilan" SET NOT NULL;
