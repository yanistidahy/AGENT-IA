-- Clé de tri alphabétique : le nom seul, plié.
--
-- Nullable, et c'est le point : `NULL` permet à `ORDER BY … NULLS LAST` de
-- ranger les fiches sans nom en fin de liste, là où la chaîne vide les
-- classerait en tête — elle est le plus petit préfixe de tout.
ALTER TABLE "companies" ADD COLUMN "nameKey" TEXT;
ALTER TABLE "contacts"  ADD COLUMN "nameKey" TEXT;
ALTER TABLE "campaigns" ADD COLUMN "nameKey" TEXT;

-- Rattrapage des lignes existantes, en SQL pur : `translate()` ne demande
-- aucune extension ni aucun privilège, contrairement à `unaccent` (jalon 10).
-- Il couvre l'alphabet latin accentué ; `lib/domain/sort-key.ts` reste la
-- référence, et réécrit la valeur exacte à la prochaine écriture de la fiche.
-- Sans ce bloc, les fiches déjà en base resteraient sans clé — donc toutes
-- reléguées en fin de liste, ce qui est exactement le défaut qu'on répare.
UPDATE "companies"
SET "nameKey" = NULLIF(
  translate(
    -- Les ligatures d'abord : `translate()` remplace caractère par caractère et
    -- ne sait pas rendre deux lettres pour une. Sans ce passage, « Œuvre »
    -- garderait son « œ », dont le point de code passe après « z » — la fiche
    -- se retrouverait en fin de liste, ce que la clé existe pour éviter.
    replace(replace(replace(replace(
      lower(btrim("name")),
      'œ', 'oe'), 'æ', 'ae'), 'ß', 'ss'), 'þ', 'th'),
    'àáâãäåèéêëìíîïòóôõöøùúûüçñýÿłðÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖØÙÚÛÜÇÑÝŁÐ',
    'aaaaaaeeeeiiiioooooouuuucnyyldaaaaaaeeeeiiiioooooouuuucnyld'),
  '');

UPDATE "contacts"
SET "nameKey" = NULLIF(
  translate(
    -- Les ligatures d'abord : `translate()` remplace caractère par caractère et
    -- ne sait pas rendre deux lettres pour une. Sans ce passage, « Œuvre »
    -- garderait son « œ », dont le point de code passe après « z » — la fiche
    -- se retrouverait en fin de liste, ce que la clé existe pour éviter.
    replace(replace(replace(replace(
      lower(btrim(btrim("lastName") || ' ' || btrim("firstName"))),
      'œ', 'oe'), 'æ', 'ae'), 'ß', 'ss'), 'þ', 'th'),
    'àáâãäåèéêëìíîïòóôõöøùúûüçñýÿłðÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖØÙÚÛÜÇÑÝŁÐ',
    'aaaaaaeeeeiiiioooooouuuucnyyldaaaaaaeeeeiiiioooooouuuucnyld'),
  '');

UPDATE "campaigns"
SET "nameKey" = NULLIF(
  translate(
    -- Les ligatures d'abord : `translate()` remplace caractère par caractère et
    -- ne sait pas rendre deux lettres pour une. Sans ce passage, « Œuvre »
    -- garderait son « œ », dont le point de code passe après « z » — la fiche
    -- se retrouverait en fin de liste, ce que la clé existe pour éviter.
    replace(replace(replace(replace(
      lower(btrim("name")),
      'œ', 'oe'), 'æ', 'ae'), 'ß', 'ss'), 'þ', 'th'),
    'àáâãäåèéêëìíîïòóôõöøùúûüçñýÿłðÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖØÙÚÛÜÇÑÝŁÐ',
    'aaaaaaeeeeiiiioooooouuuucnyyldaaaaaaeeeeiiiioooooouuuucnyld'),
  '');

-- Le tri par défaut de trois écrans passe par ces colonnes : sans index, chaque
-- chargement trierait la table entière.
CREATE INDEX "companies_nameKey_idx" ON "companies" ("nameKey");
CREATE INDEX "contacts_nameKey_idx"  ON "contacts"  ("nameKey");
