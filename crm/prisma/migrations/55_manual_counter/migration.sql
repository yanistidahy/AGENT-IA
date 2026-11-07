-- Jalon 112 — le compteur de messages manuels.
--
-- Un seul changement : la fiche d'un événement devient facultative. Un message
-- consigné au compteur n'a pas toujours de destinataire enregistré, et exiger
-- la fiche ferait soit renoncer à compter le message, soit créer une fiche vide
-- pour satisfaire une contrainte.
--
-- Aucune ligne existante ne bouge : rendre une colonne nullable ne réécrit pas
-- la table en PostgreSQL, et la clé étrangère est simplement recréée pour
-- accepter le nul en gardant sa cascade.

ALTER TABLE "outreach_events" ALTER COLUMN "contactId" DROP NOT NULL;

-- La contrainte est redéfinie à l'identique côté comportement : `ON DELETE
-- CASCADE` est conservé, donc les événements d'une fiche supprimée meurent
-- toujours avec elle (règle du jalon 109). Une ligne sans fiche n'appartient à
-- personne et survit à toute suppression.
ALTER TABLE "outreach_events" DROP CONSTRAINT "outreach_events_contactId_fkey";
ALTER TABLE "outreach_events" ADD CONSTRAINT "outreach_events_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
