-- Jalon 87 : une étape peut être écrite à la main, avec des balises.
--
-- `mode` par défaut à `alex` : toutes les étapes existantes gardent exactement
-- le comportement qu'elles avaient, et une valeur inconnue y retombe à la
-- lecture. `subject` et `body` restent vides tant qu'on n'écrit rien à la main.
ALTER TABLE "email_sequence_steps" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'alex';
ALTER TABLE "email_sequence_steps" ADD COLUMN "subject" TEXT NOT NULL DEFAULT '';
ALTER TABLE "email_sequence_steps" ADD COLUMN "body" TEXT NOT NULL DEFAULT '';
