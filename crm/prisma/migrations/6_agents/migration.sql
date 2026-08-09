-- CreateTable
CREATE TABLE "agents" (
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "shiftCadence" TEXT NOT NULL DEFAULT 'none',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "agent_photos" (
    "slug" TEXT NOT NULL,
    "sourceMime" TEXT NOT NULL,
    "portraitWebp" BYTEA NOT NULL,
    "portraitJpeg" BYTEA NOT NULL,
    "thumbWebp" BYTEA NOT NULL,
    "thumbJpeg" BYTEA NOT NULL,
    "version" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_photos_pkey" PRIMARY KEY ("slug")
);

-- AddForeignKey
ALTER TABLE "agent_photos" ADD CONSTRAINT "agent_photos_slug_fkey" FOREIGN KEY ("slug") REFERENCES "agents"("slug") ON DELETE CASCADE ON UPDATE CASCADE;


-- Les huit agents. `WHERE NOT EXISTS` : une configuration déjà présente n'est
-- jamais écrasée par un redéploiement.
INSERT INTO "agents" ("slug", "name", "role", "enabled", "order", "shiftCadence", "createdAt", "updatedAt")
SELECT seed.slug, seed.name, seed.role, seed.enabled, seed."order", seed.cadence,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('sabrina', 'Sabrina', 'Directrice des Opérations', true,  0, 'daily'),
  ('victor',  'Victor',  'Vision & Positionnement',   true,  1, 'none'),
  ('oxana',   'Oxana',   'Offre & Pricing',           true,  2, 'none'),
  ('noah',    'Noah',    'Acquisition & Marketing',   true,  3, 'none'),
  ('sarah',   'Sarah',   'Sales & Closing',           true,  4, 'daily'),
  ('heloise', 'Héloïse', 'Recrutement & Management',  true,  5, 'none'),
  ('etienne', 'Étienne', 'À définir',                 true,  6, 'none'),
  ('brutus',  'Brutus',  'Franc-parlé & Scale',       true,  7, 'none')
) AS seed(slug, name, role, enabled, "order", cadence)
WHERE NOT EXISTS (SELECT 1 FROM "agents" a WHERE a.slug = seed.slug);

-- Reprise des identifiants : « sacha » devient « sarah », « alfred » devient
-- « sabrina ». Les conversations, recommandations et vacations déjà en base
-- pointent l'ancien slug ; sans cette reprise elles désigneraient un agent
-- inexistant et disparaîtraient de l'écran sans être supprimées.
UPDATE "conversations"    SET "agentId" = 'sarah'   WHERE "agentId" = 'sacha';
UPDATE "conversations"    SET "agentId" = 'sabrina' WHERE "agentId" = 'alfred';
UPDATE "recommendations"  SET "agentId" = 'sarah'   WHERE "agentId" = 'sacha';
UPDATE "recommendations"  SET "agentId" = 'sabrina' WHERE "agentId" = 'alfred';
UPDATE "shift_runs"       SET "agentId" = 'sarah'   WHERE "agentId" = 'sacha';
UPDATE "shift_runs"       SET "agentId" = 'sabrina' WHERE "agentId" = 'alfred';

-- Les clés de déduplication portent le slug de l'agent en préfixe : sans cette
-- reprise, chaque constat de Sarah reviendrait une fois sous sa nouvelle clé.
UPDATE "recommendations" SET "dedupeKey" = 'sarah:'   || substring("dedupeKey" from 7) WHERE "dedupeKey" LIKE 'sacha:%';
UPDATE "recommendations" SET "dedupeKey" = 'sabrina:' || substring("dedupeKey" from 8) WHERE "dedupeKey" LIKE 'alfred:%';
