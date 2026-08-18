-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "emailCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastEmailAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "imapCopyEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "imapEncryption" TEXT NOT NULL DEFAULT 'tls',
ADD COLUMN     "imapHost" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "imapPort" INTEGER NOT NULL DEFAULT 993,
ADD COLUMN     "imapSentMailbox" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "openRetentionMonths" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "trackOpens" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "email_sends" (
    "id" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactId" TEXT,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "messageId" TEXT NOT NULL DEFAULT '',
    "signatoryId" TEXT NOT NULL DEFAULT '',
    "signatoryName" TEXT NOT NULL DEFAULT '',
    "tracked" BOOLEAN NOT NULL DEFAULT false,
    "trackToken" TEXT,
    "firstOpenAt" TIMESTAMP(3),
    "lastOpenAt" TIMESTAMP(3),
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "purgedAt" TIMESTAMP(3),
    "copyStatus" TEXT NOT NULL DEFAULT 'disabled',
    "copyError" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "email_sends_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_sends_trackToken_key" ON "email_sends"("trackToken");

-- CreateIndex
CREATE INDEX "email_sends_sentAt_idx" ON "email_sends"("sentAt");

-- CreateIndex
CREATE INDEX "email_sends_contactId_idx" ON "email_sends"("contactId");

-- AddForeignKey
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

