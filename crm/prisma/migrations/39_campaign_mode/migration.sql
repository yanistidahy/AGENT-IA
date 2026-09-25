-- Jalon 88 : le chemin d'une campagne, choisi à la création.
--
-- « alex » par défaut : les campagnes existantes ne changent pas de
-- comportement, et le mode qui gouverne la composition reste celui de chaque
-- étape (colonne « mode » de email_sequence_steps, jalon 87).
ALTER TABLE "campaigns" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'alex';
