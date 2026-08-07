import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.ts", "tests/**/*.test.ts"],
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
    },
  },
});
