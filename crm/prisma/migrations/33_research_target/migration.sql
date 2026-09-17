-- Jalon 75 : la cible de recherche, et d'où venait son adresse.
--
-- Deux colonnes seulement, toutes deux à valeur par défaut : les recherches
-- déjà en base gardent leurs faits et leurs sources, et se contentent de ne
-- pas savoir dire d'où venait leur cible. La prochaine lecture le renseigne.
ALTER TABLE "company_research" ADD COLUMN "targetHost" TEXT NOT NULL DEFAULT '';
ALTER TABLE "company_research" ADD COLUMN "targetSource" TEXT NOT NULL DEFAULT '';
