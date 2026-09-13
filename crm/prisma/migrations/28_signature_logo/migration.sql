-- AlterTable
ALTER TABLE "mailboxes" ADD COLUMN     "signPhone" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "mail_logo" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "sourceMime" TEXT NOT NULL,
    "png" BYTEA NOT NULL,
    "width" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "version" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_logo_pkey" PRIMARY KEY ("id")
);

