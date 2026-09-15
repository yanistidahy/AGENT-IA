-- Le marqueur de retouche manuelle : nullable, sans valeur par défaut.
-- Les brouillons existants n'ont jamais été retouchés au sens de ce marqueur,
-- et NULL le dit exactement — une date inventée ferait croire le contraire.
ALTER TABLE "sequence_departures" ADD COLUMN "editedAt" TIMESTAMP(3);
