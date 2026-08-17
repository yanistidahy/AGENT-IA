-- Jalon 32 — messagerie sortante, et le conseil réduit à deux agents.

-- 1. Configuration SMTP.
--    Le mot de passe n'est **pas** ici : il vit dans la variable d'environnement
--    SMTP_PASSWORD. Une sauvegarde JSON ou un SELECT sur cette table ne peuvent
--    donc pas le contenir — même discipline que ANTHROPIC_API_KEY.
--    `IF NOT EXISTS` : `migrate deploy` ne rejoue jamais une migration déjà
--    appliquée, mais le reste de ce fichier est idempotent et il n'y a aucune
--    raison que cette moitié ne le soit pas — un rejeu à la main doit être sans
--    effet, pas une erreur au milieu du script.
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "smtpEncryption" TEXT NOT NULL DEFAULT 'starttls',
ADD COLUMN IF NOT EXISTS "smtpFrom" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "smtpFromName" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "smtpHost" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "smtpPort" INTEGER NOT NULL DEFAULT 587,
ADD COLUMN IF NOT EXISTS "smtpUser" TEXT NOT NULL DEFAULT '';

-- 2. Alex, l'agent Emails.
--    Semé seulement s'il n'existe pas : rejouer la migration ne doit pas écraser
--    un nom ou un ordre réglés à l'écran depuis.
INSERT INTO "agents" ("slug", "name", "role", "enabled", "order", "shiftCadence", "createdAt", "updatedAt")
SELECT 'alex', 'Alex', 'Emails', true, 0, 'none', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "agents" WHERE "slug" = 'alex');

-- 3. Sabrina reste visible, et passe juste après Alex.
INSERT INTO "agents" ("slug", "name", "role", "enabled", "order", "shiftCadence", "createdAt", "updatedAt")
SELECT 'sabrina', 'Sabrina', 'Directrice des Opérations', true, 1, 'none', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "agents" WHERE "slug" = 'sabrina');

UPDATE "agents" SET "enabled" = true, "order" = 0 WHERE "slug" = 'alex';
UPDATE "agents" SET "enabled" = true, "order" = 1 WHERE "slug" = 'sabrina';

-- 4. Les six autres sont **désactivés, pas supprimés**.
--    Leurs conversations, recommandations et vacations restent intégralement
--    interrogeables : `conversations`, `recommendations` et `shift_runs` portent
--    leur `agentId` et ne sont pas touchés. Réactiver un agent est un UPDATE
--    d'une ligne ; le supprimer aurait été irréversible.
--    Les lignes absentes sont créées désactivées, sans quoi un agent jamais
--    semé retomberait sur le défaut `enabled = true` du registre.
INSERT INTO "agents" ("slug", "name", "role", "enabled", "order", "shiftCadence", "createdAt", "updatedAt")
SELECT s.slug, s.name, s.role, false, s.ord, 'none', now(), now()
FROM (VALUES
  ('victor',  'Victor',  'Vision & Positionnement',   2),
  ('oxana',   'Oxana',   'Offre & Pricing',           3),
  ('noah',    'Noah',    'Acquisition & Marketing',   4),
  ('sarah',   'Sarah',   'Sales & Closing',           5),
  ('heloise', 'Héloïse', 'Recrutement & Management',  6),
  ('etienne', 'Étienne', 'À définir',                 7),
  ('brutus',  'Brutus',  'Franc-parlé & Scale',       8)
) AS s(slug, name, role, ord)
WHERE NOT EXISTS (SELECT 1 FROM "agents" a WHERE a."slug" = s.slug);

UPDATE "agents"
SET "enabled" = false
WHERE "slug" IN ('victor', 'oxana', 'noah', 'sarah', 'heloise', 'etienne', 'brutus');
