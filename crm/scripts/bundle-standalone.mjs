import { access, cp } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

/**
 * Complète la sortie `output: "standalone"` de Next.
 *
 * Next produit `.next/standalone/server.js` avec ses seules dépendances
 * runtime, mais n'y copie ni les actifs statiques ni `public/` : c'est
 * documenté et laissé à la charge du projet. Sans cette étape, l'application
 * démarre sur Railway mais sert des pages sans CSS ni JS.
 */

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function copyInto(source, destination, label) {
  if (!(await exists(source))) {
    console.log(`  ${label.padEnd(16)} absent, ignoré`);
    return;
  }
  await cp(source, destination, { recursive: true });
  console.log(`  ${label.padEnd(16)} copié`);
}

if (!(await exists(standalone))) {
  console.error(
    "Sortie standalone introuvable. `output: \"standalone\"` est-il bien actif dans next.config.ts ?",
  );
  process.exit(1);
}

console.log("Assemblage du bundle standalone :");
await copyInto(
  path.join(root, ".next", "static"),
  path.join(standalone, ".next", "static"),
  ".next/static",
);
await copyInto(path.join(root, "public"), path.join(standalone, "public"), "public");
