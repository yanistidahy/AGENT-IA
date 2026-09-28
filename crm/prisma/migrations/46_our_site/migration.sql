-- L'adresse de notre site, réglable, et rendue cliquable par {notresite}.
--
-- Une seule colonne : le libellé visible est dérivé de l'adresse plutôt que
-- saisi à côté (voir lib/domain/our-site.ts). Le défaut est l'adresse publique
-- d'Aura Flow AI, donc les bases existantes portent la bonne valeur sans
-- qu'on ait à la ressaisir, et rien ne change pour les gabarits qui n'utilisent
-- pas la balise.
ALTER TABLE "settings" ADD COLUMN     "ourSiteUrl" TEXT NOT NULL DEFAULT 'https://auraflowai.fr/';
