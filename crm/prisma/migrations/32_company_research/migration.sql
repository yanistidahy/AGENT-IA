-- CreateTable
CREATE TABLE "company_research" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "gap" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "corpus" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "micros" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_research_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_facts" (
    "id" TEXT NOT NULL,
    "researchId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "detail" TEXT NOT NULL DEFAULT '',
    "sourceUrl" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "research_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_sources" (
    "id" TEXT NOT NULL,
    "researchId" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "research_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_research_companyId_key" ON "company_research"("companyId");

-- CreateIndex
CREATE INDEX "research_facts_researchId_idx" ON "research_facts"("researchId");

-- CreateIndex
CREATE INDEX "research_sources_researchId_idx" ON "research_sources"("researchId");

-- AddForeignKey
ALTER TABLE "company_research" ADD CONSTRAINT "company_research_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_facts" ADD CONSTRAINT "research_facts_researchId_fkey" FOREIGN KEY ("researchId") REFERENCES "company_research"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_sources" ADD CONSTRAINT "research_sources_researchId_fkey" FOREIGN KEY ("researchId") REFERENCES "company_research"("id") ON DELETE CASCADE ON UPDATE CASCADE;

