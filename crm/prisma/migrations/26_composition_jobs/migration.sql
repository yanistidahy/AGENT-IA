-- CreateTable
CREATE TABLE "composition_jobs" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "done" INTEGER NOT NULL DEFAULT 0,
    "estimateMicros" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "error" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "composition_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "composition_jobs_campaignId_idx" ON "composition_jobs"("campaignId");

-- AddForeignKey
ALTER TABLE "composition_jobs" ADD CONSTRAINT "composition_jobs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

