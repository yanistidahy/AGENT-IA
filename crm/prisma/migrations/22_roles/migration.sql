-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "alexNote" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "colleagueWarningDays" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "role_angles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "angle" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_angles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_angle_labels" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "role_angle_labels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_angle_labels_normalized_key" ON "role_angle_labels"("normalized");

-- CreateIndex
CREATE INDEX "role_angle_labels_roleId_idx" ON "role_angle_labels"("roleId");

-- AddForeignKey
ALTER TABLE "role_angle_labels" ADD CONSTRAINT "role_angle_labels_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role_angles"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Les quatre rôles de départ, **sans note d'angle** : la note s'écrit à la
-- main, dans les mots de l'utilisateur. Semés `WHERE NOT EXISTS` — une
-- configuration déjà présente n'est jamais écrasée (règle du jalon 8).
-- Un rôle reconnu sans note fait retomber Alex sur l'angle générique plutôt
-- que de lui faire combler le silence : voir lib/domain/role-angles.ts.

INSERT INTO "role_angles" ("id", "name", "angle", "position", "createdAt")
SELECT 'role_fondateur', 'Fondateur', '', 0, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "role_angles" WHERE "id" = 'role_fondateur');

INSERT INTO "role_angle_labels" ("id", "label", "normalized", "roleId")
SELECT 'role_fondateur_fondateur', 'Fondateur', 'fondateur', 'role_fondateur'
WHERE NOT EXISTS (SELECT 1 FROM "role_angle_labels" WHERE "normalized" = 'fondateur');
INSERT INTO "role_angle_labels" ("id", "label", "normalized", "roleId")
SELECT 'role_fondateur_fondatrice', 'Fondatrice', 'fondatrice', 'role_fondateur'
WHERE NOT EXISTS (SELECT 1 FROM "role_angle_labels" WHERE "normalized" = 'fondatrice');
INSERT INTO "role_angle_labels" ("id", "label", "normalized", "roleId")
SELECT 'role_fondateur_co_fondateur', 'Co-fondateur', 'co fondateur', 'role_fondateur'
WHERE NOT EXISTS (SELECT 1 FROM "role_angle_labels" WHERE "normalized" = 'co fondateur');
INSERT INTO "role_angle_labels" ("id", "label", "normalized", "roleId")
SELECT 'role_fondateur_co_fondatrice', 'Co-fondatrice', 'co fondatrice', 'role_fondateur'
WHERE NOT EXISTS (SELECT 1 FROM "role_angle_labels" WHERE "normalized" = 'co fondatrice');
INSERT INTO "role_angle_labels" ("id", "label", "normalized", "roleId")
SELECT 'role_fondateur_founder', 'Founder', 'founder', 'role_fondateur'
WHERE NOT EXISTS (SELECT 1 FROM "role_angle_labels" WHERE "normalized" = 'founder');
INSERT INTO "role_angle_labels" ("id", "label", "normalized", "roleId")
SELECT 'role_fondateur_co_founder', 'Co-founder', 'co founder', 'role_fondateur'
WHERE NOT EXISTS (SELECT 1 FROM "role_angle_labels" WHERE "normalized" = 'co founder');
INSERT INTO "role_angle_labels" ("id", "label", "normalized", "roleId")
SELECT 'role_fondateur_ceo', 'CEO', 'ceo', 'role_fondateur'
WHERE NOT EXISTS (SELECT 1 FROM "role_angle_labels" WHERE "normalized" = 'ceo');
INSERT INTO "role_angle_labels" ("id", "label", "normalized", "roleId")
SELECT 'role_fondateur_dirigeant', 'Dirigeant', 'dirigeant', 'role_fondateur'
WHERE NOT EXISTS (SELECT 1 FROM "role_angle_labels" WHERE "normalized" = 'dirigeant');
INSERT INTO "role_angle_labels" ("id", "label", "normalized", "roleId")
SELECT 'role_fondateur_gerant', 'Gérant', 'gerant', 'role_fondateur'
WHERE NOT EXISTS (SELECT 1 FROM "role_angle_labels" WHERE "normalized" = 'gerant');

INSERT INTO "role_angles" ("id", "name", "angle", "position", "createdAt")
SELECT 'role_ecommerce', 'Responsable e-commerce', '', 1, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "role_angles" WHERE "id" = 'role_ecommerce');

INSERT INTO "role_angle_labels" ("id", "label", "normalized", "roleId")
SELECT 'role_ecommerce_responsable_e_commerce', 'Responsable e-commerce', 'responsable e commerce', 'role_ecommerce'
WHERE NOT EXISTS (SELECT 1 FROM "role_angle_labels" WHERE "normalized" = 'responsable e commerce');
INSERT INTO "role_angle_labels" ("id", "label", "normalized", "roleId")
SELECT 'role_ecommerce_e_commerce_manager', 'E-commerce Manager', 'e commerce manager', 'role_ecommerce'
WHERE NOT EXISTS (SELECT 1 FROM "role_angle_labels" WHERE "normalized" = 'e commerce manager');
INSERT INTO "role_angle_labels" ("id", "label", "normalized", "roleId")
SELECT 'role_ecommerce_head_of_e_commerce', 'Head of E-commerce', 'head of e commerce', 'role_ecommerce'
WHERE NOT EXISTS (SELECT 1 FROM "role_angle_labels" WHERE "normalized" = 'head of e commerce');
INSERT INTO "role_angle_labels" ("id", "label", "normalized", "roleId")
SELECT 'role_ecommerce_directeur_e_commerce', 'Directeur e-commerce', 'directeur e commerce', 'role_ecommerce'
WHERE NOT EXISTS (SELECT 1 FROM "role_angle_labels" WHERE "normalized" = 'directeur e commerce');
INSERT INTO "role_angle_labels" ("id", "label", "normalized", "roleId")
SELECT 'role_ecommerce_directrice_e_commerce', 'Directrice e-commerce', 'directrice e commerce', 'role_ecommerce'
WHERE NOT EXISTS (SELECT 1 FROM "role_angle_labels" WHERE "normalized" = 'directrice e commerce');
INSERT INTO "role_angle_labels" ("id", "label", "normalized", "roleId")
SELECT 'role_ecommerce_responsable_digital', 'Responsable digital', 'responsable digital', 'role_ecommerce'
WHERE NOT EXISTS (SELECT 1 FROM "role_angle_labels" WHERE "normalized" = 'responsable digital');

INSERT INTO "role_angles" ("id", "name", "angle", "position", "createdAt")
SELECT 'role_cmo', 'CMO', '', 2, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "role_angles" WHERE "id" = 'role_cmo');

INSERT INTO "role_angle_labels" ("id", "label", "normalized", "roleId")
SELECT 'role_cmo_cmo', 'CMO', 'cmo', 'role_cmo'
WHERE NOT EXISTS (SELECT 1 FROM "role_angle_labels" WHERE "normalized" = 'cmo');
INSERT INTO "role_angle_labels" ("id", "label", "normalized", "roleId")
SELECT 'role_cmo_chief_marketing_officer', 'Chief Marketing Officer', 'chief marketing officer', 'role_cmo'
WHERE NOT EXISTS (SELECT 1 FROM "role_angle_labels" WHERE "normalized" = 'chief marketing officer');
INSERT INTO "role_angle_labels" ("id", "label", "normalized", "roleId")
SELECT 'role_cmo_directeur_marketing', 'Directeur marketing', 'directeur marketing', 'role_cmo'
WHERE NOT EXISTS (SELECT 1 FROM "role_angle_labels" WHERE "normalized" = 'directeur marketing');
INSERT INTO "role_angle_labels" ("id", "label", "normalized", "roleId")
SELECT 'role_cmo_directrice_marketing', 'Directrice marketing', 'directrice marketing', 'role_cmo'
WHERE NOT EXISTS (SELECT 1 FROM "role_angle_labels" WHERE "normalized" = 'directrice marketing');
INSERT INTO "role_angle_labels" ("id", "label", "normalized", "roleId")
SELECT 'role_cmo_head_of_marketing', 'Head of Marketing', 'head of marketing', 'role_cmo'
WHERE NOT EXISTS (SELECT 1 FROM "role_angle_labels" WHERE "normalized" = 'head of marketing');
INSERT INTO "role_angle_labels" ("id", "label", "normalized", "roleId")
SELECT 'role_cmo_responsable_marketing', 'Responsable marketing', 'responsable marketing', 'role_cmo'
WHERE NOT EXISTS (SELECT 1 FROM "role_angle_labels" WHERE "normalized" = 'responsable marketing');

INSERT INTO "role_angles" ("id", "name", "angle", "position", "createdAt")
SELECT 'role_sav', 'Responsable SAV', '', 3, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "role_angles" WHERE "id" = 'role_sav');

INSERT INTO "role_angle_labels" ("id", "label", "normalized", "roleId")
SELECT 'role_sav_responsable_sav', 'Responsable SAV', 'responsable sav', 'role_sav'
WHERE NOT EXISTS (SELECT 1 FROM "role_angle_labels" WHERE "normalized" = 'responsable sav');
INSERT INTO "role_angle_labels" ("id", "label", "normalized", "roleId")
SELECT 'role_sav_sav_manager', 'SAV Manager', 'sav manager', 'role_sav'
WHERE NOT EXISTS (SELECT 1 FROM "role_angle_labels" WHERE "normalized" = 'sav manager');
INSERT INTO "role_angle_labels" ("id", "label", "normalized", "roleId")
SELECT 'role_sav_head_of_customer_care', 'Head of Customer Care', 'head of customer care', 'role_sav'
WHERE NOT EXISTS (SELECT 1 FROM "role_angle_labels" WHERE "normalized" = 'head of customer care');
INSERT INTO "role_angle_labels" ("id", "label", "normalized", "roleId")
SELECT 'role_sav_responsable_service_client', 'Responsable service client', 'responsable service client', 'role_sav'
WHERE NOT EXISTS (SELECT 1 FROM "role_angle_labels" WHERE "normalized" = 'responsable service client');
INSERT INTO "role_angle_labels" ("id", "label", "normalized", "roleId")
SELECT 'role_sav_responsable_relation_client', 'Responsable relation client', 'responsable relation client', 'role_sav'
WHERE NOT EXISTS (SELECT 1 FROM "role_angle_labels" WHERE "normalized" = 'responsable relation client');
INSERT INTO "role_angle_labels" ("id", "label", "normalized", "roleId")
SELECT 'role_sav_customer_care_manager', 'Customer Care Manager', 'customer care manager', 'role_sav'
WHERE NOT EXISTS (SELECT 1 FROM "role_angle_labels" WHERE "normalized" = 'customer care manager');

