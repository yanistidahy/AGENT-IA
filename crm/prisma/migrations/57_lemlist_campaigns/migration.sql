-- Jalon 114 — l'état d'une campagne lemlist, et ses prospects en attente.
--
-- Une table neuve, aucune colonne touchée ailleurs : rien à réécrire, rien à
-- rattraper. Les lignes arrivent au premier relevé, et tant qu'elles ne sont
-- pas là l'écran retombe sur ce qu'il savait déjà déduire.

CREATE TABLE "lemlist_campaigns" (
  -- L'identifiant lemlist (`cam_…`) est la clé : c'est lui qui rapproche la
  -- ligne des événements, par `outreach_events.extCampaignId`.
  "extId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT '',
  -- Le vocabulaire publié de lemlist, recopié tel quel. La traduction vers les
  -- trois états de l'écran vit dans le domaine.
  "status" TEXT NOT NULL DEFAULT '',
  -- `NULL` dit « pas encore relevé », ce qui n'est pas « zéro prospect ».
  "leads" INTEGER,
  "leadsLaunched" INTEGER,
  "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "lemlist_campaigns_pkey" PRIMARY KEY ("extId")
);
