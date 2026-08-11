-- AlterTable
ALTER TABLE "stages" ADD COLUMN     "exitCriterion" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "website" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "deal_stage_visits" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_stage_visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deal_stage_visits_dealId_enteredAt_idx" ON "deal_stage_visits"("dealId", "enteredAt");

-- CreateIndex
CREATE INDEX "deal_stage_visits_stageId_idx" ON "deal_stage_visits"("stageId");

-- AddForeignKey
ALTER TABLE "deal_stage_visits" ADD CONSTRAINT "deal_stage_visits_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_stage_visits" ADD CONSTRAINT "deal_stage_visits_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Le pipeline suit désormais l'engagement de l'acheteur, pas notre activité.
--
-- Correspondance appliquée aux six étapes semées par `2_automation`, reconnues
-- à leur identifiant. Une étape ajoutée à la main n'est pas touchée : la
-- demande est de remplacer le jeu par défaut, pas la configuration de qui l'a
-- adaptée.
--
--   s1 Nouveau lead        (10) → Qualifié            (15)   renommée
--   s2 Contacté            (25) → Qualifié            (15)   fusionnée dans s1
--   s3 Démo planifiée      (45) → Démo planifiée      (30)   probabilité revue
--   —                           → Démo réalisée       (50)   nouvelle
--   s4 Proposition envoyée (65) → Proposition envoyée (65)   inchangée
--   s5 Négociation         (85) → Négociation         (85)   inchangée
--   s6 Gagné              (100) → Gagné              (100)   inchangée
--
-- `Nouveau lead` et `Contacté` disparaissent parce qu'elles décrivent l'avant-
-- qualification : dans le nouveau modèle, une affaire n'existe qu'à partir du
-- moment où le prospect a exprimé un désir. Leurs affaires atterrissent donc en
-- première étape.
-- ---------------------------------------------------------------------------

-- Les positions sont uniques : on les sort d'abord de la plage visée, sinon le
-- moindre échange en violerait la contrainte.
UPDATE "stages" SET "position" = "position" + 100;

UPDATE "deals" SET "stageId" = 's1' WHERE "stageId" = 's2';
DELETE FROM "stages" WHERE "id" = 's2';

UPDATE "stages" SET "name" = 'Qualifié', "prob" = 15, "position" = 0,
  "nextActionLabel" = 'Planifier la démo', "nextActionDays" = 2,
  "exitCriterion" = 'A accepté une date de démo.'
  WHERE "id" = 's1';

UPDATE "stages" SET "name" = 'Démo planifiée', "prob" = 30, "position" = 1,
  "nextActionLabel" = 'Confirmer la veille', "nextActionDays" = 1,
  "exitCriterion" = 'S''est connecté à la démo.'
  WHERE "id" = 's3';

INSERT INTO "stages" ("id", "name", "color", "prob", "position", "nextActionLabel", "nextActionDays", "exitCriterion")
SELECT 's7', 'Démo réalisée', '#2C7BE5', 50, 2, 'Envoyer la proposition', 2,
       'A demandé une proposition chiffrée.'
WHERE NOT EXISTS (SELECT 1 FROM "stages" WHERE "id" = 's7');

UPDATE "stages" SET "name" = 'Proposition envoyée', "prob" = 65, "position" = 3,
  "nextActionLabel" = 'Relancer sur la proposition', "nextActionDays" = 4,
  "exitCriterion" = 'A discuté le prix ou le périmètre.'
  WHERE "id" = 's4';

UPDATE "stages" SET "name" = 'Négociation', "prob" = 85, "position" = 4,
  "nextActionLabel" = 'Relancer la négociation', "nextActionDays" = 3,
  "exitCriterion" = 'A donné son accord verbal.'
  WHERE "id" = 's5';

UPDATE "stages" SET "name" = 'Gagné', "prob" = 100, "position" = 5,
  "exitCriterion" = 'A signé.'
  WHERE "id" = 's6';

-- Les étapes ajoutées à la main gardent leur ordre relatif, à la suite.
UPDATE "stages" SET "position" = "position" - 94 WHERE "position" >= 100;

-- « Qualifié » entre dans la liste des cycles de vie, entre Prospect et Client.
UPDATE "settings_lists" SET "position" = "position" + 1
  WHERE "kind" = 'lifecycles' AND "position" >= 2;

INSERT INTO "settings_lists" ("id", "kind", "value", "position")
SELECT 'sl-life-5', 'lifecycles', 'Qualifié', 2
WHERE EXISTS (SELECT 1 FROM "settings_lists" WHERE "kind" = 'lifecycles')
  AND NOT EXISTS (
    SELECT 1 FROM "settings_lists" WHERE "kind" = 'lifecycles' AND "value" = 'Qualifié'
  );

-- ---------------------------------------------------------------------------
-- Une visite par affaire existante, reconstituée depuis `stageSince`.
--
-- C'est tout ce que la base sait : les passages antérieurs n'ont jamais été
-- enregistrés. Les durées par étape ne deviendront donc vraies qu'à mesure que
-- de nouveaux passages s'accumulent, et l'écran doit le dire plutôt que de
-- présenter une moyenne calculée sur un seul point comme une mesure.
-- ---------------------------------------------------------------------------
INSERT INTO "deal_stage_visits" ("id", "dealId", "stageId", "enteredAt")
SELECT 'visit-' || "id", "id", "stageId", COALESCE("stageSince", "createdAt")
FROM "deals"
WHERE NOT EXISTS (SELECT 1 FROM "deal_stage_visits");
