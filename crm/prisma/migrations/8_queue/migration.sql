-- CreateTable
CREATE TABLE "queue_days" (
    "day" TEXT NOT NULL,
    "planned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "queue_days_pkey" PRIMARY KEY ("day")
);

-- CreateTable
CREATE TABLE "queue_marks" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT '',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "queue_marks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "queue_marks_day_idx" ON "queue_marks"("day");

-- CreateIndex
CREATE UNIQUE INDEX "queue_marks_day_itemId_key" ON "queue_marks"("day", "itemId");

