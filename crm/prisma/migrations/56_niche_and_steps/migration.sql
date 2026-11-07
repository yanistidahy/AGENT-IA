-- Jalon 113 v2 — les préalables de données du pilotage en quatre onglets.
--
-- Cinq colonnes, aucune suppression, aucune réécriture de ligne : les cinq
-- portent un défaut, donc PostgreSQL les ajoute sans parcourir la table.

-- La niche de la marque, en texte libre. Vide veut dire « non renseignée », et
-- l'onglet Segments en fait une ligne nommée plutôt que de la masquer.
ALTER TABLE "companies" ADD COLUMN "niche" TEXT NOT NULL DEFAULT '';

-- Qui a posé la niche, et qui a posé le trafic. Ces deux colonnes servent une
-- seule règle : la synchronisation lemlist n'écrase jamais une valeur tapée à
-- la main. Sans elles, un 8 000 saisi et un 8 000 importé seraient
-- indiscernables.
ALTER TABLE "companies" ADD COLUMN "nicheSource" TEXT NOT NULL DEFAULT '';
ALTER TABLE "companies" ADD COLUMN "visitorsSource" TEXT NOT NULL DEFAULT '';

-- **Les trafics déjà renseignés sont déclarés saisis dans le CRM**, et ce n'est
-- pas une supposition : jusqu'à cette migration le CRM était le *seul* chemin
-- d'écriture de `monthlyVisitors` — aucune synchronisation ne le remplissait.
-- Les laisser à « origine inconnue » suffirait d'ailleurs à les protéger, mais
-- dirait faux ; les déclarer `crm` dit ce qui s'est passé.
UPDATE "companies" SET "visitorsSource" = 'crm' WHERE "monthlyVisitors" IS NOT NULL;

-- L'étape de séquence qui a produit l'événement, chez la source. `NULL` se lit
-- « hors séquence » : c'est le cas du CRM, du compteur manuel et des activités
-- lemlist hors campagne. Les lignes lemlist déjà importées restent donc à NULL
-- et se remplissent à la prochaine synchronisation, qui réécrit une ligne déjà
-- connue par son `externalId` sans la dupliquer (jalon 113).
ALTER TABLE "outreach_events" ADD COLUMN "stepIndex" INTEGER;
ALTER TABLE "outreach_events" ADD COLUMN "stepType" TEXT NOT NULL DEFAULT '';
