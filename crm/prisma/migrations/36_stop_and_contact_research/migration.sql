-- Jalon 84.
--
-- 1. L'arrêt de la composition : un signal en base, relu par la boucle avant
--    chaque brouillon. En mémoire, il serait perdu au redéploiement et la
--    demande d'arrêt viendrait d'une autre requête que celle qui compose.
--
-- 2. Une recherche qui peut appartenir à une **fiche sans société**. Jusqu'ici
--    elle était strictement indexée par société, si bien que le domaine déduit
--    de l'adresse électronique (jalon 75) n'était jamais consulté pour une
--    fiche sans maison : la recherche n'était pas appelée du tout. `companyId`
--    devient donc nullable, et `contactId` est la seconde ancre.

ALTER TABLE "composition_jobs" ADD COLUMN "stopRequestedAt" TIMESTAMP(3),
                               ADD COLUMN "stopped" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "company_research" ADD COLUMN "contactId" TEXT,
                               ALTER COLUMN "companyId" DROP NOT NULL;

CREATE UNIQUE INDEX "company_research_contactId_key" ON "company_research"("contactId");

ALTER TABLE "company_research" ADD CONSTRAINT "company_research_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
