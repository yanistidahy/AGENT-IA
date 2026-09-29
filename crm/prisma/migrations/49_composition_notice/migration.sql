-- Ce que la composition a laissé pour demain : le plafond du jour d'une boîte
-- est atteint, et on n'a pas payé des brouillons qui seraient à réécrire demain
-- matin. Distinct de `error` : rien n'a échoué.
ALTER TABLE "composition_jobs" ADD COLUMN     "notice" TEXT NOT NULL DEFAULT '';
