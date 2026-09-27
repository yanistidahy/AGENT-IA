-- CreateTable
CREATE TABLE "email_link_clicks" (
    "id" TEXT NOT NULL,
    "emailSendId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_link_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_tabs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT,
    "query" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_tabs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_link_clicks_emailSendId_idx" ON "email_link_clicks"("emailSendId");

-- CreateIndex
CREATE INDEX "email_link_clicks_at_idx" ON "email_link_clicks"("at");

-- CreateIndex
CREATE INDEX "task_tabs_nameKey_idx" ON "task_tabs"("nameKey");

-- AddForeignKey
ALTER TABLE "email_link_clicks" ADD CONSTRAINT "email_link_clicks_emailSendId_fkey" FOREIGN KEY ("emailSendId") REFERENCES "email_sends"("id") ON DELETE CASCADE ON UPDATE CASCADE;

