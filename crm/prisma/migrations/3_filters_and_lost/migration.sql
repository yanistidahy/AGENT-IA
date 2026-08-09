-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "searchText" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "lostReason" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "searchText" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "tag" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "searchText" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "contacts_tag_idx" ON "contacts"("tag");

-- ---------------------------------------------------------------------------
-- Remplissage initial des colonnes de recherche.
--
-- Sans ce bloc, les 150 prospects déjà importés seraient introuvables jusqu'à
-- leur prochaine modification : une colonne ajoutée vide ne se remplit pas
-- toute seule, et personne n'irait rouvrir 150 fiches pour la déclencher.
--
-- `translate()` plutôt que l'extension `unaccent` : aucun privilège particulier
-- n'est requis, la migration ne peut donc pas échouer sur une base gérée dont
-- on n'est pas superutilisateur. La table de correspondance couvre l'alphabet
-- latin usuel — c'est le même repli que `fold()` en TypeScript, qui reprend la
-- main dès la première écriture sur la fiche.
-- ---------------------------------------------------------------------------
UPDATE "companies" SET "searchText" = translate(
  lower(concat_ws(' ', "name", "domain", "industry", "loc")),
  'àáâãäåçèéêëìíîïñòóôõöùúûüýÿœæ',
  'aaaaaaceeeeiiiinooooouuuuyyoa'
);

UPDATE "contacts" SET "searchText" = translate(
  lower(concat_ws(' ', "firstName", "lastName", "email", "phone", "title", "dep")),
  'àáâãäåçèéêëìíîïñòóôõöùúûüýÿœæ',
  'aaaaaaceeeeiiiinooooouuuuyyoa'
);

UPDATE "deals" SET "searchText" = translate(
  lower(concat_ws(' ', "name", "offer")),
  'àáâãäåçèéêëìíîïñòóôõöùúûüýÿœæ',
  'aaaaaaceeeeiiiinooooouuuuyyoa'
);

-- Le cycle de vie « Perdu » rejoint la liste éditable, si elle est peuplée et
-- ne le contient pas déjà. Sans cela, il resterait absent du menu de /reglages.
INSERT INTO "settings_lists" ("id", "kind", "value", "position")
SELECT 'lc-perdu', 'lifecycles', 'Perdu',
       COALESCE((SELECT MAX("position") + 1 FROM "settings_lists" WHERE "kind" = 'lifecycles'), 0)
WHERE EXISTS (SELECT 1 FROM "settings_lists" WHERE "kind" = 'lifecycles')
  AND NOT EXISTS (
    SELECT 1 FROM "settings_lists" WHERE "kind" = 'lifecycles' AND "value" = 'Perdu'
  );
