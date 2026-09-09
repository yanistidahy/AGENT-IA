-- AlterTable
ALTER TABLE "email_sends" ADD COLUMN     "mailboxId" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "email_sequences" ADD COLUMN     "campaignId" TEXT;

-- CreateTable
CREATE TABLE "mailboxes" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "smtpHost" TEXT NOT NULL DEFAULT '',
    "smtpPort" INTEGER NOT NULL DEFAULT 587,
    "smtpEncryption" TEXT NOT NULL DEFAULT 'starttls',
    "smtpUser" TEXT NOT NULL DEFAULT '',
    "smtpFrom" TEXT NOT NULL DEFAULT '',
    "smtpFromName" TEXT NOT NULL DEFAULT '',
    "imapHost" TEXT NOT NULL DEFAULT '',
    "imapPort" INTEGER NOT NULL DEFAULT 993,
    "imapEncryption" TEXT NOT NULL DEFAULT 'tls',
    "imapSentMailbox" TEXT NOT NULL DEFAULT '',
    "imapCopyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "signName" TEXT NOT NULL DEFAULT '',
    "signTitle" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mailboxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "selection" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mailboxes_slug_key" ON "mailboxes"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "email_sequences_campaignId_key" ON "email_sequences"("campaignId");

-- AddForeignKey
ALTER TABLE "email_sequences" ADD CONSTRAINT "email_sequences_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "mailboxes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- La boîte « principale », reprise de la configuration unique du jalon 32.
--
-- `WHERE NOT EXISTS` : une configuration déjà migrée n'est jamais écrasée
-- (règle du jalon 8). La signature vient du signataire par défaut du jalon 35
-- s'il existe, à défaut des colonnes signName/signTitle des réglages. Le mot
-- de passe reste où il est : SMTP_PASSWORD sert de repli à
-- SMTP_PASSWORD_PRINCIPALE (voir lib/api/mailboxes.ts), donc le déploiement
-- en cours continue d'envoyer sans qu'aucune variable ne soit posée.
INSERT INTO "mailboxes" (
  "id", "slug", "label", "position", "active",
  "smtpHost", "smtpPort", "smtpEncryption", "smtpUser", "smtpFrom", "smtpFromName",
  "imapHost", "imapPort", "imapEncryption", "imapSentMailbox", "imapCopyEnabled",
  "signName", "signTitle", "createdAt"
)
SELECT
  'mbx_principale', 'principale', 'Boîte principale', 0, true,
  s."smtpHost", s."smtpPort", s."smtpEncryption", s."smtpUser", s."smtpFrom", s."smtpFromName",
  s."imapHost", s."imapPort", s."imapEncryption", s."imapSentMailbox", s."imapCopyEnabled",
  COALESCE((SELECT sig."name" FROM "signatories" sig WHERE sig."isDefault" LIMIT 1), s."signName"),
  COALESCE((SELECT sig."title" FROM "signatories" sig WHERE sig."isDefault" LIMIT 1), s."signTitle"),
  CURRENT_TIMESTAMP
FROM "settings" s
WHERE s."id" = 'singleton'
  AND NOT EXISTS (SELECT 1 FROM "mailboxes");

-- Une base neuve n'a pas encore de ligne de réglages : elle reçoit une boîte
-- vide à compléter, pour que l'écran des boîtes ne parte jamais de rien.
INSERT INTO "mailboxes" ("id", "slug", "label", "position", "signName", "signTitle", "createdAt")
SELECT 'mbx_principale', 'principale', 'Boîte principale', 0, 'Yanis Tidahy', 'Fondateur, Aura Flow AI', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "mailboxes");

-- Chaque séquence existante est enveloppée dans une campagne portée par la
-- boîte principale : la définition déménage de /reglages vers /campagnes sans
-- interrompre une seule inscription en cours. Idempotent — seules les
-- séquences encore orphelines sont enveloppées.
INSERT INTO "campaigns" ("id", "name", "mailboxId", "selection", "createdAt")
SELECT 'camp_' || seq."id", seq."name", 'mbx_principale', '', CURRENT_TIMESTAMP
FROM "email_sequences" seq
WHERE seq."campaignId" IS NULL
  AND EXISTS (SELECT 1 FROM "mailboxes" WHERE "id" = 'mbx_principale');

UPDATE "email_sequences" seq
SET "campaignId" = 'camp_' || seq."id"
WHERE seq."campaignId" IS NULL
  AND EXISTS (SELECT 1 FROM "campaigns" WHERE "id" = 'camp_' || seq."id");
