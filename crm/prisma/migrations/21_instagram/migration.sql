-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "instagram" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "relanceApresInstagram" INTEGER NOT NULL DEFAULT 4;


-- La source « Instagram » rejoint la liste de référence, sans jamais écraser
-- une configuration existante : `WHERE NOT EXISTS` sur la valeur exacte, comme
-- au jalon 8. La position 4 la place après « Site web ».
INSERT INTO "settings_lists" ("id", "kind", "value", "position")
SELECT 'sl-source-5', 'sources', 'Instagram', 4
WHERE NOT EXISTS (
  SELECT 1 FROM "settings_lists" WHERE "kind" = 'sources' AND "value" = 'Instagram'
);
