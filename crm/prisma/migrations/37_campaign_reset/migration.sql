-- Jalon 86 : réinitialiser une campagne ouvre un nouveau tour.
--
-- Le passé n'est pas effacé : les départs déjà composés gardent le tour 1, et
-- la clé d'unicité leur fait place au lieu de les remplacer. Sans `round`, un
-- second premier message serait impossible à composer — la contrainte
-- (inscription, étape) l'aurait refusé — ou il aurait fallu supprimer des
-- lignes qui sont la trace de ce qui est parti.

ALTER TABLE "sequence_enrollments" ADD COLUMN "round" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "sequence_enrollments" ADD COLUMN "resetAt" TIMESTAMP(3);

ALTER TABLE "sequence_departures" ADD COLUMN "round" INTEGER NOT NULL DEFAULT 1;

DROP INDEX "sequence_departures_enrollmentId_step_key";
CREATE UNIQUE INDEX "sequence_departures_enrollmentId_step_round_key"
  ON "sequence_departures"("enrollmentId", "step", "round");
