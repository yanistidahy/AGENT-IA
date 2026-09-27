-- Routage des contacts « Autre » et « Non classé » vers une variante.
--
-- Le défaut est `default` : les campagnes existantes continuent donc de servir
-- le message par défaut de l'étape à ces contacts, donc exactement le même
-- contenu qu'avant ce jalon. Une campagne neuve naît en `direction`, écrit
-- explicitement par `createCampaign` — jamais par ce défaut, qui n'existe que
-- pour ne rien changer au passé.
--
-- Rien ici ne touche `contacts` : le routage choisit un texte, pas un groupe.
ALTER TABLE "campaigns" ADD COLUMN     "otherRouting" TEXT NOT NULL DEFAULT 'default';
