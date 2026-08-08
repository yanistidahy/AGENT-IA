-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "shiftTokenBudget" INTEGER NOT NULL DEFAULT 4000;

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL DEFAULT '',
    "evidence" TEXT NOT NULL DEFAULT '[]',
    "actions" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'new',
    "dedupeKey" TEXT NOT NULL,
    "snoozedUntil" TIMESTAMP(3),
    "mutedUntil" TIMESTAMP(3),
    "dismissReason" TEXT NOT NULL DEFAULT '',
    "decidedAt" TIMESTAMP(3),
    "runId" TEXT,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_runs" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER,
    "outcome" TEXT NOT NULL DEFAULT 'ok',
    "detail" TEXT NOT NULL DEFAULT '',
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "produced" INTEGER NOT NULL DEFAULT 0,
    "manual" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "shift_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recommendations_dedupeKey_key" ON "recommendations"("dedupeKey");

-- CreateIndex
CREATE INDEX "recommendations_status_idx" ON "recommendations"("status");

-- CreateIndex
CREATE INDEX "recommendations_agentId_idx" ON "recommendations"("agentId");

-- CreateIndex
CREATE INDEX "shift_runs_startedAt_idx" ON "shift_runs"("startedAt");

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_runId_fkey" FOREIGN KEY ("runId") REFERENCES "shift_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

