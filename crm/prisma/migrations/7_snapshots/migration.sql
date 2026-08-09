-- CreateTable
CREATE TABLE "snapshot_runs" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" TEXT NOT NULL DEFAULT 'ok',
    "key" TEXT NOT NULL DEFAULT '',
    "bytes" INTEGER NOT NULL DEFAULT 0,
    "pruned" INTEGER NOT NULL DEFAULT 0,
    "detail" TEXT NOT NULL DEFAULT '',
    "durationMs" INTEGER,
    "manual" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "snapshot_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "snapshot_runs_startedAt_idx" ON "snapshot_runs"("startedAt");

