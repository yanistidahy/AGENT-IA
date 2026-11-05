-- Jalon 109 : les trois cibles hebdomadaires du pilotage.
--
-- Les deux objectifs de « Ma performance » (objectifAppelsSemaine,
-- objectifEmailsSemaine) ne sont PAS supprimés : l'écran qui les éditait part,
-- la donnée reste. Supprimer une colonne est irréversible, et laisser deux
-- valeurs saisies derrière un écran retiré ne coûte rien.
ALTER TABLE "settings" ADD COLUMN "cibleMessagesSemaine" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "settings" ADD COLUMN "cibleDemosSemaine" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "settings" ADD COLUMN "cibleQualifieesSemaine" INTEGER NOT NULL DEFAULT 5;
