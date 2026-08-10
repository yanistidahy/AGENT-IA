import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // `.tsx` compris : rendre un composant depuis un test demande du JSX, que
    // TypeScript refuse dans un fichier `.ts`. Sans cette extension, un test de
    // composant écrit en `.tsx` serait ignoré en silence — le pire des cas,
    // puisqu'il aurait l'air d'exister.
    include: [
      "lib/**/*.test.ts?(x)",
      "app/**/*.test.ts?(x)",
      "components/**/*.test.ts?(x)",
      "tests/**/*.test.ts?(x)",
    ],
  },
  /**
   * `tsconfig.json` fixe `jsx: "preserve"` — c'est Next qui compile le JSX en
   * production. Vitest, lui, exécute les fichiers directement : sans cette ligne,
   * importer un composant depuis un test échoue sur « invalid JS syntax ».
   */
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: {
      "@": path.resolve(),
      // Voir tests/stubs/server-only.ts : le vrai paquet lève à l'import et
      // rendrait intestable tout module serveur.
      "server-only": path.resolve("tests/stubs/server-only.ts"),
    },
  },
});
