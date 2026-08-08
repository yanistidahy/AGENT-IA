import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  applyLifecycleFix,
  lifecycleSnapshot,
  planLifecycleFix,
} from "../lib/api/maintenance";
import { STATUS_CORRECTIONS } from "./corrections-2026-08";

/**
 * Correction ponctuelle des cycles de vie, à partir de la feuille de prospection.
 *
 * **Ce n'est pas une migration.** Une migration décrit une forme de base ; ceci
 * corrige des *valeurs*, sur la foi d'un tableur qui n'est pas le schéma. Dans
 * `prisma/migrations/`, il rejouerait sur toute base neuve, y compris de test,
 * où ces contacts n'existent pas.
 *
 * La règle vit dans `lib/api/maintenance.ts` — ce fichier n'est qu'une façade en
 * ligne de commande, l'autre étant le bouton de `/reglages`. Deux façades, une
 * seule logique : c'est ce qui garantit que le bouton et le terminal font
 * exactement la même chose.
 *
 * Usage :
 *   npx tsx scripts/fix-lifecycles.ts            # simulation
 *   npx tsx scripts/fix-lifecycles.ts --apply    # écriture, après sauvegarde
 */
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main(): Promise<void> {
  console.log(APPLY ? "== APPLICATION ==\n" : "== SIMULATION (aucune écriture) ==\n");

  const plan = await planLifecycleFix(STATUS_CORRECTIONS);

  for (const warning of plan.warnings) console.log(`  ⚠ ${warning}`);
  if (plan.warnings.length > 0) console.log("");

  for (const change of plan.changes) {
    const motif = change.lostReason === "" ? "" : ` · motif : ${change.lostReason}`;
    const flag = change.uncertain ? " [rapprochement incertain]" : "";
    console.log(
      `  ${change.label}\n    ${change.from} → ${change.lifecycle}${motif}${flag}\n    ${change.evidence}`,
    );
  }

  const byTarget = new Map<string, number>();
  for (const change of plan.changes) {
    const key =
      change.lostReason === "" ? change.lifecycle : `${change.lifecycle} · ${change.lostReason}`;
    byTarget.set(key, (byTarget.get(key) ?? 0) + 1);
  }

  console.log("\n-- Répartition --");
  for (const [key, count] of [...byTarget.entries()].sort()) {
    console.log(`  ${String(count).padStart(3)}  ${key}`);
  }
  console.log(`  ${String(plan.unchanged).padStart(3)}  déjà à jour (aucune écriture)`);
  console.log(`  ${String(plan.changes.length).padStart(3)}  fiches à modifier`);
  console.log(
    `  ${String(plan.changes.filter((c) => c.uncertain).length).padStart(3)}  dont rapprochement incertain (sans adresse électronique)`,
  );

  if (!APPLY) {
    console.log("\nRien n'a été écrit. Relancer avec --apply pour appliquer.");
    return;
  }
  if (plan.changes.length === 0) {
    console.log("\nRien à faire.");
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(process.cwd(), "backups");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `lifecycles-${stamp}.json`);
  await writeFile(file, JSON.stringify(lifecycleSnapshot(plan), null, 2), "utf8");
  console.log(`\nSauvegarde écrite : ${file}`);

  const written = await applyLifecycleFix(plan);
  console.log(`${written} fiches corrigées, ${written} interactions consignées.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
