import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TASK_TABS, tabView, type TaskRow } from "@/lib/domain/task-tabs";
import type { TaskKind } from "@/lib/domain/task-kind";

/**
 * **Une pastille et sa liste sortent du même appel, ou le test tombe.**
 *
 * Le défaut que ce fichier ferme ne lève rien, ne casse aucun type et ne rougit
 * aucun test de rendu : deux comptages justes chacun de son côté, affichés l'un
 * au-dessus de l'autre, et qui finissent par ne plus dire la même chose. Le
 * jalon 49 l'a payé entre une puce et sa liste, le jalon 78 entre une carte et
 * son tableau, et dans les deux cas on avait cessé de croire les deux nombres.
 *
 * Le jalon 105 **renforce** l'invariant. Deux fonctions partageant un prédicat
 * laissaient toujours la possibilité d'en appeler une sur un tableau et l'autre
 * sur un autre — et c'est précisément ce qui est arrivé au filtre par personne :
 * compter sur toutes les tâches au-dessus d'une liste filtrée annonce le travail
 * de quelqu'un d'autre. `tabView()` rend donc **les deux**, à partir d'un tableau
 * filtré une fois, et il n'existe plus d'ordre d'appel qui les sépare.
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

/* Une population couvrant les quatre onglets, deux personnes et quatre types. */
function row(over: Partial<TaskRow> & { readonly id: string }): TaskRow {
  return {
    title: `tâche ${over.id}`,
    kind: "tache" as TaskKind,
    due: new Date("2026-10-03T09:00:00Z"),
    done: false,
    doneAt: null,
    priority: "normale",
    assignee: "Yanis",
    contactId: null,
    contactName: "",
    contactPhone: "",
    detail: "",
    href: null,
    searchText: `tache ${over.id}`,
    ...over,
  };
}

const NOW = new Date("2026-10-03T12:00:00Z");

const POPULATION: readonly TaskRow[] = [
  row({ id: "a", kind: "appel", due: new Date("2026-09-30T09:00:00Z") }),
  row({ id: "b", kind: "appel", assignee: "Mohamed" }),
  row({ id: "c", kind: "email", due: new Date("2026-10-09T09:00:00Z") }),
  row({ id: "d", kind: "instagram", assignee: "Mohamed", due: new Date("2026-10-09T09:00:00Z") }),
  row({ id: "e", done: true, doneAt: new Date("2026-10-02T09:00:00Z") }),
  row({ id: "f", done: true, assignee: "Mohamed", doneAt: new Date("2026-10-01T09:00:00Z") }),
  row({ id: "g" }),
  row({ id: "h", assignee: "" }),
];

describe("une pastille ne peut pas contredire sa liste", () => {
  it("chaque pastille égale la longueur de sa liste, pour chaque personne", () => {
    /*
      **C'est l'invariant du jalon, et il est vérifié sous tous les filtres par
      personne** — y compris « Tous ». Sans la boucle sur les personnes, un
      comptage non filtré passerait : c'est exactement la forme du défaut que
      « Vos tâches » portait.
    */
    for (const person of ["", "Yanis", "Mohamed", "Inconnu"]) {
      for (const definition of TASK_TABS) {
        const view = tabView(POPULATION, definition.id, person, NOW);
        expect(
          view.counts[definition.id],
          `onglet ${definition.id}, personne « ${person || "tous"} »`,
        ).toBe(view.inTab.length);
      }
    }
  });

  it("les pastilles ne changent pas selon l'onglet ouvert", () => {
    /*
      Une pastille décrit son onglet, pas celui qu'on regarde. Si ouvrir « À
      venir » changeait le nombre d'« Aujourd'hui », les quatre nombres ne
      seraient plus comparables entre eux.
    */
    const reference = tabView(POPULATION, "aujourdhui", "", NOW).counts;
    for (const definition of TASK_TABS) {
      expect(tabView(POPULATION, definition.id, "", NOW).counts).toEqual(reference);
    }
  });

  it("les quatre onglets partitionnent les tâches, sans trou ni doublon", () => {
    /*
      Hors « Appels », qui est une vue transversale : une tâche d'appel due
      aujourd'hui est à la fois dans « Aujourd'hui » et dans « Appels », et c'est
      voulu. Les trois autres doivent couvrir exactement la population.
    */
    const view = tabView(POPULATION, "aujourdhui", "", NOW);
    const sum = view.counts.aujourdhui + view.counts.avenir + view.counts.terminees;
    expect(sum).toBe(POPULATION.length);
  });

  it("une tâche d'appel terminée n'est plus dans « Appels »", () => {
    // Sinon l'onglet se remplirait de travail fait, et cesserait d'être une file.
    const done = [row({ id: "x", kind: "appel", done: true, doneAt: NOW })];
    expect(tabView(done, "appels", "", NOW).counts.appels).toBe(0);
    expect(tabView(done, "terminees", "", NOW).inTab).toHaveLength(1);
  });

  it("le filtre par personne est appliqué avant le comptage", () => {
    const code = codeOf("lib/domain/task-tabs.ts");
    const view = code.slice(code.indexOf("export function tabView"));
    const body = view.slice(0, view.indexOf("\n}"));
    // `scoped` est calculé une fois, et c'est lui que les deux sorties lisent.
    expect(body).toMatch(/const scoped = rows\.filter\(\(row\) => keptForPerson\(row, person\)\)/);
    expect(body.indexOf("const scoped")).toBeLessThan(body.indexOf("counts["));
    expect(body).toMatch(/scoped\s*\n?\s*\.filter\(\(row\) => TAB_PREDICATES\[tab\]/);
    expect(body).toMatch(/scoped\.reduce/);
    // Et rien ne relit `rows` après : ce serait le tableau non filtré.
    expect(body.slice(body.indexOf("const counts"))).not.toMatch(/\brows\b/);
  });
});

describe("un prédicat par onglet, et rien d'autre ne décide", () => {
  it("la table couvre exactement les onglets déclarés", () => {
    const code = codeOf("lib/domain/task-tabs.ts");
    const table = code.slice(code.indexOf("const TAB_PREDICATES"));
    const declared = table.slice(0, table.indexOf("};"));
    for (const definition of TASK_TABS) {
      expect(declared, `l'onglet ${definition.id} a son prédicat`).toContain(`${definition.id}:`);
    }
  });

  it("aucun écran ne recompose la règle d'un onglet", () => {
    /*
      Un composant qui écrirait sa propre condition — « !done && due <= today » —
      rendrait une liste que la pastille ne compterait pas. Les écrans lisent
      `tabView`, jamais la table des prédicats.
    */
    const offenders = walk("components")
      .concat(walk("app"))
      .filter((file) => /TAB_PREDICATES/.test(codeOf(file)));
    expect(offenders).toEqual([]);
  });

  it("l'écran appelle tabView, et une seule fois", () => {
    const code = codeOf("components/tasks/tasks-view.tsx");
    expect(code).toMatch(/tabView\(rows, tab, person, now, filters, search\)/);
    expect(code.match(/tabView\(/g) ?? []).toHaveLength(1);
    // Les deux sorties viennent de cet appel, pas de deux calculs voisins.
    expect(code).toMatch(/counts=\{view\.counts\}/);
    expect(code).toMatch(/view\.shown/);
  });

  it("« Prospects chauds » ne lit aucun champ d'ouverture", () => {
    /*
      **L'ouverture du pixel ne qualifie personne** (jalons 37 et 43) : elle
      surestime par construction. Ni la lecture des prospects chauds ni l'audit
      de ses clics ne doivent pouvoir s'appuyer dessus.
    */
    for (const file of ["lib/api/hot-prospects.ts", "lib/domain/hot-clicks.ts"]) {
      expect(codeOf(file)).not.toMatch(/firstOpenAt|openCount|lastOpenAt|emailOpenHit/);
    }
  });

  it("le compte des prospects chauds et le filtre /contacts sortent de la même fonction", () => {
    /*
      Un lien qui annoncerait vingt prospects et en ouvrirait dix-huit ferait
      cesser de croire les deux (jalon 49). La clause de `/contacts?chauds=1` ne
      recompose donc rien : elle reçoit les identifiants déjà résolus.
    */
    const contacts = codeOf("lib/api/contacts.ts");
    expect(contacts).toMatch(/readHotProspects\(now\)\)\.ids/);
    expect(contacts).not.toMatch(/emailLinkClick|emailReply/);
    expect(codeOf("lib/api/task-feed.ts")).toMatch(/readHotProspects\(/);
  });

  it("l'écran des tâches n'écrit rien pour alimenter un onglet", () => {
    /*
      Pas de colonne d'onglet, pas de ligne dupliquée : la lecture ne fait que
      lire. Un état à tenir finit toujours par contredire ce qu'il décrit.
    */
    expect(codeOf("lib/api/task-feed.ts")).not.toMatch(
      /prisma\.\w+\.(create|update|upsert|delete)/,
    );
    expect(codeOf("lib/domain/task-tabs.ts")).not.toMatch(/prisma/);
  });

  it("la file des départs n'est pas relue à côté de « Départs du jour »", () => {
    // Deux lectures d'une même file finiraient par ne plus dire la même chose.
    const feed = codeOf("lib/api/task-feed.ts");
    expect(feed).toMatch(/listDepartures\(/);
    expect(feed).not.toMatch(/prisma\.sequenceDeparture/);
  });

  it("« Appel passé » consigne et coche par une seule route", () => {
    /*
      Cocher sans consigner perdrait le seul fait qui prouve l'appel. L'écran n'a
      donc qu'un chemin, et c'est `markCallDone` — jamais un `PATCH done` suivi
      d'un `POST activities`, qui pourrait s'arrêter au milieu.
    */
    for (const file of ["components/tasks/task-rows.tsx", "components/tasks/focus-mode.tsx"]) {
      const code = codeOf(file);
      expect(code).toMatch(/markCallDone\(/);
      expect(code).not.toMatch(/api\/activities/);
    }
    const service = codeOf("lib/api/tasks.ts");
    const call = service.slice(service.indexOf("export async function markCallDone"));
    expect(call).toMatch(/logActivity\(\{/);
    expect(call).toMatch(/type: "call"/);
    // L'interaction part **avant** l'achèvement : une tâche cochée dont
    // l'interaction a échoué est un travail qu'on croit tracé et qui ne l'est pas.
    expect(call.indexOf("logActivity({")).toBeLessThan(call.indexOf("tx.task.update"));
  });

  it("le mode focus ne facture rien et n'envoie plus de départ", () => {
    const focus = codeOf("components/tasks/focus-mode.tsx");
    expect(focus).not.toMatch(/api\/emails|draftEmail|anthropic/i);
    // Les départs ont leur bandeau et leur page : un second chemin d'envoi
    // aurait deux jeux de garde-fous (jalon 91).
    expect(focus).not.toMatch(/api\/departures/);
  });

  it("une tâche de réponse ne peut pas être créée deux fois", () => {
    /*
      L'idempotence est portée par la contrainte d'unicité d'`autoKey`, pas par
      une vérification applicative qu'une course contournerait (jalon 8). Et la
      clé **ne se libère jamais** : une tâche de réponse cochée ne doit pas
      revenir au relevé suivant.
    */
    const inbox = codeOf("lib/api/inbox.ts");
    const create = inbox.slice(inbox.indexOf("async function createReplyTask"));
    const body = create.slice(0, create.indexOf("\n}\n"));
    expect(body).toMatch(/autoKey: autoKey\("reponse", replyMessageId\)/);
    expect(body).toMatch(/kind: "email"/);
    expect(body).toMatch(/catch/);
    // Jamais un upsert ni une libération de clé : les deux recréeraient la tâche.
    expect(body).not.toMatch(/upsert|autoKey: null/);
  });
});
