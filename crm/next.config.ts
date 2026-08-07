import path from "node:path";
import type { NextConfig } from "next";

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
};

export default nextConfig;
