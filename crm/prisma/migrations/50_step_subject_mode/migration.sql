-- **Une relance peut ouvrir sa propre conversation, si on le demande.**
--
-- Le défaut est `thread` : c'est la règle du jalon 101, conservée telle quelle
-- pour toutes les étapes existantes — leur objet reste celui de l'étape 1, et
-- leur sortie MIME ne bouge pas d'un octet. `custom` ouvre le champ Objet de
-- l'étape, variantes comprises, et le destinataire reçoit alors un message dans
-- une nouvelle conversation.
ALTER TABLE "email_sequence_steps" ADD COLUMN     "subjectMode" TEXT NOT NULL DEFAULT 'thread';
