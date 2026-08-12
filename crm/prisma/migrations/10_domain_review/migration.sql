-- CreateTable
CREATE TABLE "domain_rejections" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "proposed" TEXT NOT NULL,
    "rejectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domain_rejections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "domain_rejections_companyId_key" ON "domain_rejections"("companyId");

-- AddForeignKey
ALTER TABLE "domain_rejections" ADD CONSTRAINT "domain_rejections_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

