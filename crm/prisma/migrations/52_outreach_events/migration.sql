-- Jalon 109 : le journal des événements de prospection, et le segment des sociétés.
--
-- Rien n'est supprimé ni modifié : les envois, les réponses, les clics, les
-- interactions et les tâches restent intacts. Ce jalon retire des écrans, pas
-- des faits — la reprise les lit, elle ne les déplace pas.

ALTER TABLE "companies" ADD COLUMN "monthlyVisitors" INTEGER;

CREATE TABLE "outreach_events" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "companyId" TEXT,
    "campaignId" TEXT,
    "channel" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "owner" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'crm',
    "externalId" TEXT,
    "replyCategory" TEXT NOT NULL DEFAULT '',
    "detail" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outreach_events_pkey" PRIMARY KEY ("id")
);

-- La déduplication de la synchronisation à venir. Deux `null` ne se heurtent
-- pas : elle ne porte donc que sur ce qui vient d'une source externe.
CREATE UNIQUE INDEX "outreach_events_source_externalId_key" ON "outreach_events"("source", "externalId");
CREATE INDEX "outreach_events_occurredAt_idx" ON "outreach_events"("occurredAt");
CREATE INDEX "outreach_events_type_occurredAt_idx" ON "outreach_events"("type", "occurredAt");
CREATE INDEX "outreach_events_contactId_type_idx" ON "outreach_events"("contactId", "type");
CREATE INDEX "outreach_events_campaignId_idx" ON "outreach_events"("campaignId");

ALTER TABLE "outreach_events" ADD CONSTRAINT "outreach_events_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outreach_events" ADD CONSTRAINT "outreach_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "outreach_events" ADD CONSTRAINT "outreach_events_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
