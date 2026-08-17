-- Jalon 35 — deux personnes signent, plus une seule.

CREATE TABLE IF NOT EXISTS "signatories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "signatories_pkey" PRIMARY KEY ("id")
);

-- Les deux signataires, semés seulement si la table est vide.
--
-- La condition porte sur la **table entière** et non sur chaque ligne : rejouer
-- la migration après un renommage à l'écran ne doit pas réintroduire les noms
-- d'usine à côté des noms corrigés.
INSERT INTO "signatories" ("id", "name", "title", "isDefault", "position")
SELECT * FROM (VALUES
  ('sig_yanis',   'Yanis Tidahy',   'Fondateur, Aura Flow AI',    true,  0),
  ('sig_mohamed', 'Mohamed Targani', 'Co-Fondateur, Aura Flow AI', false, 1)
) AS seed(id, name, title, "isDefault", position)
WHERE NOT EXISTS (SELECT 1 FROM "signatories");

-- Le lien de démonstration devient la réservation d'un créneau.
--
-- `WHERE` sur l'ancienne valeur : une adresse déjà personnalisée n'a pas à être
-- écrasée par une migration.
UPDATE "settings"
SET "demoLabel" = 'Réserver un appel',
    "demoUrl"   = 'https://calendly.com/auraflowai-y7hh/30min'
WHERE "demoUrl" = 'https://deluxe-fudge-addd15.netlify.app/'
   OR "demoUrl" = '';
