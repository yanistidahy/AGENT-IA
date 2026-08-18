-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "modelChat" TEXT NOT NULL DEFAULT 'claude-sonnet-5',
ADD COLUMN     "modelDraft" TEXT NOT NULL DEFAULT 'claude-sonnet-5',
ADD COLUMN     "modelRevision" TEXT NOT NULL DEFAULT 'claude-sonnet-5',
ADD COLUMN     "modelShift" TEXT NOT NULL DEFAULT 'claude-opus-5',
ADD COLUMN     "monthlyBudgetCents" INTEGER NOT NULL DEFAULT 2000;

-- CreateTable
CREATE TABLE "api_usage" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "day" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "thinkingTokens" INTEGER,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "costMicros" INTEGER NOT NULL DEFAULT 0,
    "anomaly" BOOLEAN NOT NULL DEFAULT false,
    "detail" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "api_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_usage_month_idx" ON "api_usage"("month");

-- CreateIndex
CREATE INDEX "api_usage_day_idx" ON "api_usage"("day");

-- CreateIndex
CREATE INDEX "api_usage_agentId_idx" ON "api_usage"("agentId");

-- CreateIndex
CREATE INDEX "api_usage_purpose_idx" ON "api_usage"("purpose");

