-- Jalon 115 — les abonnements mensuels Mollie.
--
-- Une table neuve, aucune colonne touchée ailleurs : rien à réécrire, rien à
-- rattraper. Sans clé étrangère vers `companies`, volontairement : la
-- restauration supprime puis recrée les sociétés, et ne doit jamais emporter
-- l'état de ce qu'un client paie réellement (voir le modèle Subscription).

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "amountCents" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "mollieCustomerId" TEXT,
    "mollieFirstPaymentId" TEXT,
    "mollieSubscriptionId" TEXT,
    "mollieMandateId" TEXT,
    "startDate" TEXT,
    "activationClaimedAt" TIMESTAMP(3),
    "firstPaidAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "lastPaymentStatus" TEXT NOT NULL DEFAULT '',
    "lastPaymentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_token_key" ON "subscriptions"("token");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_mollieSubscriptionId_key" ON "subscriptions"("mollieSubscriptionId");

-- CreateIndex
CREATE INDEX "subscriptions_companyId_idx" ON "subscriptions"("companyId");
