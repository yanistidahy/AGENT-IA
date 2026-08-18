-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "lastCronAt" TIMESTAMP(3),
ADD COLUMN     "sendLimitNotice" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sendLimitNoticeAt" TIMESTAMP(3),
ADD COLUMN     "sendPerDay" INTEGER NOT NULL DEFAULT 150,
ADD COLUMN     "sendPerHour" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "email_sends" ADD COLUMN     "sequenceId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sequenceName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sequenceStep" INTEGER;

-- CreateTable
CREATE TABLE "email_sequences" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autoMode" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "email_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_sequence_steps" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "delayDays" INTEGER NOT NULL DEFAULT 0,
    "brief" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "email_sequence_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequence_enrollments" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'active',
    "stopReason" TEXT NOT NULL DEFAULT '',
    "lastStep" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3),

    CONSTRAINT "sequence_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequence_departures" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "day" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "subject" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "decidedAt" TIMESTAMP(3),
    "detail" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "sequence_departures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_sequence_steps_sequenceId_position_key" ON "email_sequence_steps"("sequenceId", "position");

-- CreateIndex
CREATE INDEX "sequence_enrollments_status_idx" ON "sequence_enrollments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sequence_enrollments_sequenceId_contactId_key" ON "sequence_enrollments"("sequenceId", "contactId");

-- CreateIndex
CREATE INDEX "sequence_departures_day_status_idx" ON "sequence_departures"("day", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sequence_departures_enrollmentId_step_key" ON "sequence_departures"("enrollmentId", "step");

-- AddForeignKey
ALTER TABLE "email_sequence_steps" ADD CONSTRAINT "email_sequence_steps_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "email_sequences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "email_sequences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_departures" ADD CONSTRAINT "sequence_departures_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "sequence_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

