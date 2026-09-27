-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "groupFilter" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "contactGroup" TEXT NOT NULL DEFAULT 'autre',
ADD COLUMN     "groupSetBy" TEXT NOT NULL DEFAULT 'none';

-- CreateTable
CREATE TABLE "email_step_variants" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "email_step_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_step_variants_stepId_group_key" ON "email_step_variants"("stepId", "group");

-- CreateIndex
CREATE INDEX "contacts_contactGroup_idx" ON "contacts"("contactGroup");

-- AddForeignKey
ALTER TABLE "email_step_variants" ADD CONSTRAINT "email_step_variants_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "email_sequence_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

