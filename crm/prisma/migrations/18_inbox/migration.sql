-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "inboxPollEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastInboxPollAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "email_replies" (
    "id" TEXT NOT NULL,
    "replyMessageId" TEXT NOT NULL,
    "sentMessageId" TEXT NOT NULL,
    "emailSendId" TEXT,
    "contactId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activityId" TEXT,

    CONSTRAINT "email_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_replies_replyMessageId_key" ON "email_replies"("replyMessageId");

-- CreateIndex
CREATE INDEX "email_replies_sentMessageId_idx" ON "email_replies"("sentMessageId");

-- AddForeignKey
ALTER TABLE "email_replies" ADD CONSTRAINT "email_replies_emailSendId_fkey" FOREIGN KEY ("emailSendId") REFERENCES "email_sends"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_replies" ADD CONSTRAINT "email_replies_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

