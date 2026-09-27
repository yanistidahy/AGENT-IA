import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TASK_TABS, TAB_PREDICATES } from "@/lib/domain/task-tabs";

/**
 * **Une pastille et sa liste partagent leur prédicat, ou le test tombe.**
 *
 * Le défaut que ce fichier ferme ne lève rien, ne casse aucun type et ne rougit
 * aucun test de rendu : deux comptages justes chacun de son côté, affichés l'un
 * au-dessus de l'autre, et qui finissent par ne plus dire la même chose. Le
 * jalon 49 l'a payé entre une puce et sa liste, le jalon 78 entre une carte et
 * son tableau, et dans les deux cas on avait cessé de croire les deux nombres.
 *
 * Même famille que `status-single-source`, `cost-single-source`,
 * `research-single-source` et `campaign-funnel-source` : statique, parce que le
 * défaut l'est.
 */

const ROOT = join(__dirname, "..");
const source = (file: string) => readFileSync(join(ROOT, file), "utf8");

/** Le code d'un fichier, commentaires retirés — sinon la garde attrape sa propre documentation. */
function codeOf(file: string): string {
  return source(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir))) {
    const path = `${dir}/${entry}`;
    if (statSync(join(ROOT, path)).isDirectory()) out.push(...walk(path));
    else if (/\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

describe("un prédicat par onglet, et rien d'autre ne décide", () => {
  it("le comptage et la liste appellent le même TAB_PREDICATES", () => {
    const code = codeOf("lib/domain/task-tabs.ts");
    // `countTab` compte, `rowsForTab` filtre : les deux doivent lire la table.
    const count = code.slice(code.indexOf("export function countTab"));
    const rows = code.slice(code.indexOf("export function rowsForTab"));
    expect(count.slice(0, 300)).toMatch(/TAB_PREDICATES\[tab\]\(row, now\)/);
    expect(rows.slice(0, 300)).toMatch(/TAB_PREDICATES\[tab\]\(row, now\)/);

    /*
      **Et rien de plus.** Un cas particulier glissé dans l'une des deux — « si
      l'onglet est celui-ci, filtre autrement » — laisserait les deux appels en
      place tout en faisant diverger les nombres : c'est exactement la forme du
      défaut, et la première version de cette garde ne l'attrapait pas.
    */
    for (const body of [count.slice(0, count.indexOf("\n}")), rows.slice(0, rows.indexOf("\n}"))]) {
      expect(body).not.toMatch(/row\.(kind|done|due|pendingSend|unhandledReply|hotSignal)/);
      expect(body).not.toMatch(/tab === /);
    }
  });

  it("la table couvre exactement les onglets déclarés", () => {
    expect(Object.keys(TAB_PREDICATES).sort()).toEqual(TASK_TABS.map((tab) => tab.id).sort());
  });

  it("aucun écran ne recompose la règle d'un onglet", () => {
    /*
      Un composant qui écrirait sa propre condition — « kind === "departure" &&
      pendingSend » — rendrait une liste que la pastille ne compterait pas. Les
      écrans lisent `rowsForTab`/`tabCounts`, jamais les champs de décision.
    */
    const offenders = walk("components")
      .concat(walk("app"))
      .filter((file) => /pendingSend|unhandledReply|hotSignal/.test(codeOf(file)));
    expect(offenders).toEqual([]);
  });

  it("« Prospects chauds » ne lit aucun champ d'ouverture", () => {
    /*
      **L'ouverture du pixel ne qualifie personne** (jalons 37 et 43) : elle
      surestime par construction. Ni le prédicat ni la lecture qui l'alimente ne
      doivent pouvoir s'appuyer dessus.
    */
    const predicate = codeOf("lib/domain/task-tabs.ts");
    const feed = codeOf("lib/api/task-feed.ts");
    for (const code of [predicate, feed]) {
      expect(code).not.toMatch(/firstOpenAt|openCount|lastOpenAt|emailOpenHit/);
    }
  });

  it("l'écran des tâches n'écrit rien pour alimenter un onglet", () => {
    /*
      Pas de colonne d'onglet, pas de statut « traité », pas de ligne dupliquée :
      la lecture ne fait que lire. Un état à tenir finit toujours par contredire
      ce qu'il décrit.
    */
    const feed = codeOf("lib/api/task-feed.ts");
    expect(feed).not.toMatch(/prisma\.\w+\.(create|update|upsert|delete)/);
    expect(codeOf("lib/domain/task-tabs.ts")).not.toMatch(/prisma/);
  });

  it("la file des départs n'est pas relue à côté de « Départs du jour »", () => {
    // Deux lectures d'une même file finiraient par ne plus dire la même chose.
    const feed = codeOf("lib/api/task-feed.ts");
    expect(feed).toMatch(/listDepartures\(/);
    expect(feed).not.toMatch(/prisma\.sequenceDeparture/);
  });

  it("le mode focus envoie par la route de « Départs du jour »", () => {
    /*
      Un second chemin d'envoi aurait deux jeux de garde-fous, et c'est toujours
      le second qui oublie la fiche passée en « Perdu » (jalon 91).
    */
    const focus = codeOf("components/tasks/focus-mode.tsx");
    expect(focus).toMatch(/"\/api\/departures"/);
    expect(focus).toMatch(/action: "send"/);
    // Et il ne facture rien : aucune rédaction sur un geste manuel.
    expect(focus).not.toMatch(/api\/emails|draftEmail|anthropic/i);
  });
});
