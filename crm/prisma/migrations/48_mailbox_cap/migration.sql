-- Le plafond d'envoi quotidien, appliqué à chaque boîte.
-- Le défaut porte sur la colonne : la ligne de réglages déjà en base lit 50
-- sans que personne ait à ouvrir l'écran.
ALTER TABLE "settings" ADD COLUMN     "dailyMailboxCap" INTEGER NOT NULL DEFAULT 50;
