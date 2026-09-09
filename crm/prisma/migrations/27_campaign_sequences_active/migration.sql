-- Les séquences de campagne redeviennent actives.
--
-- Une campagne créée avant ce jalon portait une séquence `active = false`
-- (jalon 54). Cela ne protégeait de rien — un départ ne part que sur un clic —
-- mais empêchait toute composition, y compris celle qu'on venait de demander en
-- enregistrant. Une campagne enregistrée restait donc muette, sans que rien ne
-- le dise.
--
-- **Les campagnes archivées ne sont pas touchées** : leur séquence a été
-- désactivée délibérément par l'archivage, et la réactiver ferait recomposer
-- pour des campagnes qu'on a explicitement rangées.
UPDATE "email_sequences" AS s
SET "active" = true
FROM "campaigns" AS c
WHERE s."campaignId" = c."id"
  AND c."archivedAt" IS NULL
  AND s."active" = false;
