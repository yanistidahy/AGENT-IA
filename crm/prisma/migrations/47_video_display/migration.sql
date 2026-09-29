-- Comment la vidéo se montre dans un courriel : un lien texte, ou une vignette.
-- Le défaut porte sur la colonne, donc la ligne de réglages déjà en base lit
-- « Lien texte » sans que personne ait à cliquer.
ALTER TABLE "settings" ADD COLUMN     "videoDisplay" TEXT NOT NULL DEFAULT 'link';
