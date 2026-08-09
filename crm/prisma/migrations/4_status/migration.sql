-- Statut de relance saisi, et issue de l'échange.
--
-- Les deux colonnes naissent vides à dessein : tant qu'aucun statut n'est saisi,
-- la fiche continue d'afficher son statut **calculé**. Les contacts déjà
-- importés ne bougent donc pas tant qu'on ne les touche pas — c'est la condition
-- pour que ce changement de conception n'invente pas d'information.
ALTER TABLE "contacts" ADD COLUMN     "status" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "statusSetAt" TIMESTAMP(3);

ALTER TABLE "activities" ADD COLUMN     "outcome" TEXT NOT NULL DEFAULT '';
