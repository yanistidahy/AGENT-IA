-- AlterTable
ALTER TABLE "email_sends" ADD COLUMN     "campaignId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "campaignName" TEXT NOT NULL DEFAULT '';


-- Les envois déjà partis d'une séquence appartiennent à la campagne qui la
-- porte (le jalon 54 en a enveloppé chacune) : les laisser vides ferait
-- disparaître de /emails toute l'histoire d'avant ce jalon.
UPDATE "email_sends" AS s
SET "campaignId" = c."id", "campaignName" = c."name"
FROM "campaigns" AS c, "email_sequences" AS q
WHERE q."campaignId" = c."id" AND q."id" = s."sequenceId"
  AND s."sequenceId" <> '' AND s."campaignId" = '';
