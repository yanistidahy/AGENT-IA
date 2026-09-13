-- Jalon 63 : un second rendu du logo pour l'interface, et la mesure de sa
-- lisibilité sur le rail sombre.
--
-- Toutes les colonnes sont NULLABLES, et c'est le point de cette migration.
-- Le logo déjà en base a été téléversé avant ce jalon : seuls ses octets
-- **réencodés à 120 px** existent, l'original n'est jamais conservé (jalon 62).
-- On ne peut donc pas en produire un rendu net rétroactivement.
--
-- NULL veut dire « pas encore calculé », et l'application s'en charge à la
-- première lecture : elle dérive un rendu depuis le PNG de courriel, le range
-- ici, et **dit à l'écran qu'il est adouci** puisqu'il vient d'une source de
-- 120 px. Le logo apparaît donc dans le rail sans aucun geste, et retéléverser
-- le fichier d'origine le rend net. Supprimer la ligne aurait été plus simple à
-- écrire et aurait forcé un second téléversement pour un fichier déjà fourni.
ALTER TABLE "mail_logo" ADD COLUMN "chrome" BYTEA;
ALTER TABLE "mail_logo" ADD COLUMN "chromeWidth" INTEGER;
ALTER TABLE "mail_logo" ADD COLUMN "chromeBytes" INTEGER;
-- Vrai quand le rendu d'interface a été dérivé du PNG de courriel faute
-- d'original : c'est ce qui autorise l'écran à annoncer une image adoucie.
ALTER TABLE "mail_logo" ADD COLUMN "chromeFromEmail" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "mail_logo" ADD COLUMN "inkR" INTEGER;
ALTER TABLE "mail_logo" ADD COLUMN "inkG" INTEGER;
ALTER TABLE "mail_logo" ADD COLUMN "inkB" INTEGER;
ALTER TABLE "mail_logo" ADD COLUMN "transparency" INTEGER;
