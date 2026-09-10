import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Les tests de navigateur, **séparés de la suite**.
 *
 * Ils demandent un serveur debout, une base peuplée et un Chromium : trois
 * conditions que `npm test` ne doit jamais exiger, sous peine de devenir un
 * test qu'on n'exécute plus. `npm run e2e` les lance ; ils s'ignorent d'eux-mêmes
 * quand une condition manque, en le disant.
 *
 * Ils tournent **en série** : ils partagent un serveur et une base, et deux
 * navigateurs qui filtrent la même liste en même temps ne prouvent rien.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/e2e/**/*.e2e.ts?(x)"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: { "@": path.resolve() },
  },
});
