-- AlterTable
ALTER TABLE "stages" ADD COLUMN     "nextActionDays" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "nextActionLabel" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "stageSince" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "auto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoKey" TEXT;

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "relanceApresAppel" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "relanceApresDemo" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "relanceApresEmail" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "relanceApresNote" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "relanceApresReunion" INTEGER NOT NULL DEFAULT 3;

-- CreateIndex
CREATE UNIQUE INDEX "tasks_autoKey_key" ON "tasks"("autoKey");


-- ---------------------------------------------------------------------------
-- Données de référence minimales.
--
-- Une base dont `stages` ou `settings_lists` est vide rend le formulaire
-- « Nouvelle affaire » inutilisable : les listes Étape, Propriétaire et Offre
-- s'affichent vides et une affaire ne peut pas être enregistrée correctement.
-- Cela arrive sur une installation neuve (migrate deploy crée des tables vides,
-- le seed est manuel) et après un vidage accidentel d'une liste éditable.
--
-- Ces insertions sont conditionnelles : elles ne touchent rien si la table
-- contient déjà quelque chose, et rejouer la migration ne duplique pas.
-- Ce sont des valeurs de départ, pas le jeu de démonstration — `npm run db:seed`
-- reste ce qui charge les 24 affaires d'exemple.
-- ---------------------------------------------------------------------------

INSERT INTO "stages" ("id", "name", "color", "prob", "position", "nextActionLabel", "nextActionDays")
SELECT * FROM (VALUES
  ('s1', 'Nouveau lead',        '#6E8B86',  10, 0, 'Qualifier le besoin',            2),
  ('s2', 'Contacté',            '#2C7BE5',  25, 1, 'Relancer pour un rendez-vous',   3),
  ('s3', 'Démo planifiée',      '#6D5AE6',  45, 2, 'Préparer la démo',               1),
  ('s4', 'Proposition envoyée', '#D99323',  65, 3, 'Relancer sur la proposition',    4),
  ('s5', 'Négociation',         '#E8503F',  85, 4, 'Relancer la négociation',        3),
  ('s6', 'Gagné',               '#0FA88F', 100, 5, '',                               0)
) AS defaults
WHERE NOT EXISTS (SELECT 1 FROM "stages");

INSERT INTO "settings_lists" ("id", "kind", "value", "position")
SELECT * FROM (VALUES
  ('sl-owner-1',  'owners',     'Yanis',            0),
  ('sl-offer-1',  'offers',     'Starter',          0),
  ('sl-offer-2',  'offers',     'Pro',              1),
  ('sl-offer-3',  'offers',     'Sur-mesure',       2),
  ('sl-source-1', 'sources',    'Cold Email',       0),
  ('sl-source-2', 'sources',    'LinkedIn',         1),
  ('sl-source-3', 'sources',    'Recommandation',   2),
  ('sl-source-4', 'sources',    'Site web',         3),
  ('sl-life-1',   'lifecycles', 'Lead',             0),
  ('sl-life-2',   'lifecycles', 'Prospect',         1),
  ('sl-life-3',   'lifecycles', 'Client',           2),
  ('sl-life-4',   'lifecycles', 'Ancien Client',    3)
) AS defaults
WHERE NOT EXISTS (SELECT 1 FROM "settings_lists");

INSERT INTO "settings" ("id", "staleDays", "coldDays", "objectifMensuel", "notifs", "updatedAt")
SELECT 'singleton', 7, 14, 15000, true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "settings");
