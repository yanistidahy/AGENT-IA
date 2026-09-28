-- L'empreinte du gabarit dont un départ a été composé.
--
-- Le défaut est la chaîne vide, et c'est délibéré : les départs déjà en file en
-- portent une, et ils doivent se lire « on ne sait pas », jamais « périmé ».
-- Les marquer périmés d'office allumerait un avertissement sur toute la file au
-- premier déploiement, et une alerte qui sonne partout ne se lit plus.
ALTER TABLE "sequence_departures" ADD COLUMN     "templateHash" TEXT NOT NULL DEFAULT '';
