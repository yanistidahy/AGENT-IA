-- Jalon 105 : le canal d'une tâche devient une colonne.
--
-- Jusqu'ici l'onglet « Appels » reconnaissait une tâche d'appel **à son
-- intitulé** (jalon 92), faute de colonne. Le type est maintenant saisi à la
-- création ; cette migration reprend l'existant une fois, avec la même règle
-- étroite que celle qui servait à l'affichage — donc sans reclasser personne
-- autrement que l'écran ne le faisait déjà hier.
--
-- Le défaut porte sur la colonne : toute tâche qui ne correspond pas lit
-- « tache », et c'est ce qui rend la reprise sûre sans script.
ALTER TABLE "tasks" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'tache';

-- `\y` est la frontière de mot de PostgreSQL, l'équivalent du `\b` de
-- `isCallTitle` : « coordinatrice » ne contient pas « appel », et on ne veut pas
-- qu'un mot plus long se reconnaisse dans un mot plus court (règle du jalon 94).
UPDATE "tasks"
   SET "kind" = 'appel'
 WHERE "title" ~* '\y(appel|appeler|rappeler|t[ée]l[ée]phon)';
