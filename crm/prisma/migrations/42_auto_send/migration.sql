-- CreateTable
CREATE TABLE "auto_send" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "intervalSeconds" INTEGER NOT NULL DEFAULT 210,
    "startMinute" INTEGER NOT NULL DEFAULT 540,
    "endMinute" INTEGER NOT NULL DEFAULT 1020,
    "vary" BOOLEAN NOT NULL DEFAULT true,
    "dueAt" TIMESTAMP(3),
    "lastSendAt" TIMESTAMP(3),
    "lastTickAt" TIMESTAMP(3),
    "failures" INTEGER NOT NULL DEFAULT 0,
    "stoppedReason" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_send_pkey" PRIMARY KEY ("id")
);

