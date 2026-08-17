-- Jalon 34 — le vrai pitch, la signature réglable, le lien de démonstration.
--
-- Ces quatre valeurs étaient du code au jalon 33 ; elles deviennent de la
-- donnée parce qu'elles changent sans que le produit change : l'associé signe
-- de son propre nom, et l'adresse de la démonstration bougera avant la fin de
-- l'année. Aucune n'est un secret — le mot de passe SMTP reste, lui, dans
-- SMTP_PASSWORD et hors de cette table.
ALTER TABLE "settings"
  ADD COLUMN IF NOT EXISTS "demoLabel" TEXT NOT NULL DEFAULT 'Diagnostic offert',
  ADD COLUMN IF NOT EXISTS "demoUrl"   TEXT NOT NULL DEFAULT 'https://deluxe-fudge-addd15.netlify.app/',
  ADD COLUMN IF NOT EXISTS "signName"  TEXT NOT NULL DEFAULT 'Yanis Tidahy',
  ADD COLUMN IF NOT EXISTS "signTitle" TEXT NOT NULL DEFAULT 'Fondateur, Aura Flow AI';
