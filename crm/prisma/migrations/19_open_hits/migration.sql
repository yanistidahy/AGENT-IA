-- AlterTable
ALTER TABLE "email_sends" ADD COLUMN     "openNoise" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "email_open_hits" (
    "id" TEXT NOT NULL,
    "emailSendId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delaySeconds" INTEGER NOT NULL DEFAULT 0,
    "kind" TEXT NOT NULL DEFAULT 'counted',

    CONSTRAINT "email_open_hits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_open_hits_emailSendId_idx" ON "email_open_hits"("emailSendId");

-- AddForeignKey
ALTER TABLE "email_open_hits" ADD CONSTRAINT "email_open_hits_emailSendId_fkey" FOREIGN KEY ("emailSendId") REFERENCES "email_sends"("id") ON DELETE CASCADE ON UPDATE CASCADE;

