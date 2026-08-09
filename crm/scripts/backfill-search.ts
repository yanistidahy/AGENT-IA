import { PrismaClient } from "@prisma/client";
import { applySearchBackfill, planSearchBackfill } from "../lib/api/maintenance";

/**
 * Rattrapage du miroir de recherche (`searchText`).
 *
 * Nécessaire parce que l'import de contacts et la création de société à la volée
 * ne l'écrivaient pas : toute fiche entrée par ces deux chemins depuis le
 * jalon 10 est introuvable à la recherche jusqu'à sa prochaine modification.
 * Les deux sources sont corrigées ; ce script rattrape l'existant.
 *
 * `searchText` est **dérivé** : il ne porte aucune information qui ne soit déjà
 * ailleurs. Le recalculer ne peut donc rien perdre — d'où l'absence de
 * sauvegarde préalable, contrairement à une correction de statut.
 *
 * Usage :
 *   npx tsx scripts/backfill-search.ts            # simulation
 *   npx tsx scripts/backfill-search.ts --apply    # écriture
 */
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main(): Promise<void> {
  console.log(APPLY ? "== APPLICATION ==\n" : "== SIMULATION (aucune écriture) ==\n");

  const plan = await planSearchBackfill();

  for (const [table, rows] of [
    ["contacts", plan.contacts],
    ["sociétés", plan.companies],
    ["affaires", plan.deals],
  ] as const) {
    if (rows.length === 0) continue;
    console.log(`-- ${table} (${rows.length}) --`);
    for (const row of rows.slice(0, 10)) {
      console.log(`  ${row.label}\n    « ${row.before} » → « ${row.after} »`);
    }
    if (rows.length > 10) console.log(`  … et ${rows.length - 10} autre(s).`);
    console.log("");
  }

  console.log(`${plan.total} ligne(s) à corriger.`);

  if (!APPLY) {
    console.log("Rien n'a été écrit. Relancer avec --apply pour appliquer.");
    return;
  }

  const written = await applySearchBackfill(plan);
  console.log(`${written} ligne(s) corrigée(s).`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
