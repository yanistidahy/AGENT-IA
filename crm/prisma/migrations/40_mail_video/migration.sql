-- La vidéo de démonstration : hébergée ou téléversée, jamais attachée.
--
-- Singleton comme `mail_logo`, et table séparée pour la même raison : les
-- octets d'une vidéo n'ont aucune raison d'être lus à chaque lecture de la
-- configuration d'envoi.
CREATE TABLE "mail_video" (
  "id"              TEXT NOT NULL DEFAULT 'singleton',
  "kind"            TEXT NOT NULL DEFAULT 'hosted',
  "url"             TEXT NOT NULL DEFAULT '',
  "file"            BYTEA,
  "fileMime"        TEXT NOT NULL DEFAULT '',
  "fileBytes"       INTEGER NOT NULL DEFAULT 0,
  "poster"          BYTEA NOT NULL,
  "posterMime"      TEXT NOT NULL DEFAULT 'image/jpeg',
  "posterWidth"     INTEGER NOT NULL,
  "posterBytes"     INTEGER NOT NULL,
  "posterGenerated" BOOLEAN NOT NULL DEFAULT false,
  "label"           TEXT NOT NULL DEFAULT 'Voir la démonstration en vidéo',
  "version"         TEXT NOT NULL,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mail_video_pkey" PRIMARY KEY ("id")
);
