import path from "node:path";
import type { NextConfig } from "next";
import { REQUEST_BODY_LIMIT } from "./lib/domain/signature-video";

/**
 * `outputFileTracingRoot` est explicite : ce projet vit dans `crm/` à l'intérieur
 * d'un dépôt qui contient un autre `package-lock.json` à la racine. Sans cette
 * ligne, Next remonte jusqu'à la racine du dépôt pour tracer les fichiers et
 * produit `.next/standalone/crm/server.js` au lieu de `.next/standalone/server.js`,
 * ce qui casse la commande de démarrage sur Railway.
 */
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(),
  poweredByHeader: false,
  reactStrictMode: true,

  /**
   * **Le corps d'une requête est tronqué à 10 Mo par défaut, et c'est le
   * middleware qui l'impose.**
   *
   * Dès qu'un middleware existe, Next doit pouvoir lui donner le corps de la
   * requête : il le met donc en tampon, avec un plafond. Le nôtre tourne sur
   * chaque requête — c'est le verrou d'espace de travail du jalon 9, et « tout
   * est privé par défaut » n'est pas négociable. Conséquence, mesurée : un
   * téléversement de vidéo de plus de 10 Mo arrivait **coupé**,
   * `request.formData()` ne trouvait plus sa frontière de fin, levait
   * `TypeError: Failed to parse body as FormData`, et l'écran n'affichait que
   * « Le serveur n'a pas pu traiter la demande. » Le contrôle de poids de la
   * route, lui, n'était jamais atteint : il lisait `file.size`, qui n'existe
   * qu'après l'analyse qui venait d'échouer.
   *
   * La valeur vient du domaine et reste **au-dessus** de `MAX_VIDEO_UPLOAD` :
   * c'est ce qui garantit qu'un fichier trop lourd est refusé par une phrase à
   * nous, qui dit quoi faire, plutôt que par une troncature muette. Un test fige
   * l'ordre des deux.
   *
   * Ce plafond porte sur **toutes** les routes, pas seulement celle-ci : c'est le
   * prix d'un tampon partagé, et la raison de ne pas le pousser plus haut que
   * nécessaire — chaque requête peut désormais coûter cette mémoire.
   */
  experimental: { middlewareClientMaxBodySize: REQUEST_BODY_LIMIT },
};

export default nextConfig;
