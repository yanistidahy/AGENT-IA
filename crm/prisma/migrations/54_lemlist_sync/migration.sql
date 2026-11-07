-- Jalon 111 — la synchronisation lemlist entre dans le journal de prospection.
--
-- Trois changements, et aucune donnée touchée : deux colonnes par défaut vides
-- sur le journal, et deux tables neuves. Un `ALTER TABLE ... ADD COLUMN ... NOT
-- NULL DEFAULT ''` ne réécrit pas la table en PostgreSQL 11+ — la valeur par
-- défaut est stockée dans le catalogue —, donc la migration reste instantanée
-- sur un journal déjà peuplé.

-- La campagne chez la source, quand elle n'existe pas dans le CRM.
ALTER TABLE "outreach_events" ADD COLUMN "extCampaignId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "outreach_events" ADD COLUMN "extCampaignName" TEXT NOT NULL DEFAULT '';

-- « Campagnes côte à côte » regroupe sur cette colonne quand la campagne du
-- CRM est absente : l'index sert ce regroupement.
CREATE INDEX "outreach_events_extCampaignId_idx" ON "outreach_events"("extCampaignId");

-- L'état du relevé, une seule ligne, sans aucune clé d'API.
CREATE TABLE "lemlist_sync" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "lastSuccessAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "lastError" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "lastRead" INTEGER NOT NULL DEFAULT 0,
    "lastWritten" INTEGER NOT NULL DEFAULT 0,
    "historyDone" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lemlist_sync_pkey" PRIMARY KEY ("id")
);

-- Ce que la synchronisation n'a pas su faire : types sans correspondance et
-- rapprochements ambigus. `(kind, key)` est unique, donc le même type inconnu
-- rencontré mille fois produit une ligne dont `seen` monte.
CREATE TABLE "lemlist_issues" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "seen" INTEGER NOT NULL DEFAULT 1,
    "firstAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lemlist_issues_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lemlist_issues_kind_key_key" ON "lemlist_issues"("kind", "key");
CREATE INDEX "lemlist_issues_kind_idx" ON "lemlist_issues"("kind");
