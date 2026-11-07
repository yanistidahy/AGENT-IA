import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { TIMELINE_METRICS, GRANULARITIES, TIMELINE_VIEWS } from "@/lib/domain/timeline";
import { OUTREACH_CHANNELS } from "@/lib/domain/outreach";
import { BANDS } from "@/components/pilotage/timeline-plot";

/**
 * **« Dans le temps », sous garde statique.**
 *
 * Cinq façons de défaire ce jalon sans qu'aucun type ne soit violé, sans
 * qu'aucune exception ne lève et sans qu'aucun test existant ne rougisse :
 *
 * 1. **la valeur d'un point cesse de venir de `metricResult`.** C'est le seul
 *    endroit où l'invariant du jalon 109 se perdrait : un point calculé à part
 *    de la liste qu'il ouvre peut en différer, et personne ne le verrait ;
 * 2. **une vue se remet à compter.** La garde du jalon 109 couvre déjà
 *    `components/pilotage/**` ; celle-ci ajoute ce qui est propre au
 *    graphique — pas de `metricResult` dans une vue, pas de découpage de
 *    période ;
 * 3. **les canaux ne se distinguent plus que par la couleur.** Six lignes qui
 *    ne diffèrent que par la teinte sont six lignes illisibles pour un
 *    daltonien, en noir et blanc et à l'impression ;
 * 4. **la date d'un événement lemlist redevient celle de l'import.** C'est la
 *    partie 1 du jalon, et elle se vérifie sur le fichier : une seule écriture,
 *    et elle prend la date de l'activité ;
 * 5. **la reprise du CRM redevient inatteignable.** Elle est restée deux
 *    jalons sans appelant, et septembre est resté vide en production pour cette
 *    seule raison.
 */

const ROOT = path.join(__dirname, "..");

/** Le code sans ses commentaires : ce projet nomme ce qu'il interdit. */
function strip(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const read = (file: string) => strip(readFileSync(path.join(ROOT, file), "utf8"));
const readAll = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

const domain = read("lib/domain/timeline.ts");
const page = read("app/(crm)/pilotage/page.tsx");
const chart = read("components/pilotage/timeline-chart.tsx");
const plot = read("components/pilotage/timeline-plot.tsx");
const tooltip = read("components/pilotage/timeline-tooltip.tsx");
const toolbar = read("components/pilotage/timeline-toolbar.tsx");
const pace = read("components/pilotage/week-pace.tsx");

/* ---------------------------------------------- un point, une seule valeur - */

describe("la valeur d'un point est celle de sa liste", () => {
  /**
   * `pointValue` **appelle** `metricResult`. C'est tout l'invariant du jalon
   * 109 appliqué au graphique : il n'y a pas un comptage « pour la barre » et
   * une requête « pour la liste ».
   */
  it("pointValue passe par metricResult", () => {
    expect(domain).toMatch(/export function pointValue[\s\S]{0,400}metricResult\(/);
    expect(domain).toContain('from "./pilotage"');
  });

  it("la série par canal recompte, elle ne divise pas le total", () => {
    // Une répartition obtenue en divisant le total ne correspondrait à aucune
    // liste : chaque canal est compté par le même chemin que le total.
    expect(domain).toMatch(/byChannel\[channel\] = pointValue\(/);
    expect(domain).not.toMatch(/byChannel\[channel\] = Math\.round/);
  });

  it("aucune vue n'appelle metricResult ni ne découpe une période", () => {
    for (const [name, source] of [
      ["chart", chart],
      ["plot", plot],
      ["tooltip", tooltip],
      ["toolbar", toolbar],
      ["pace", pace],
    ] as const) {
      expect(source, `${name} compte`).not.toContain("metricResult");
      expect(source, `${name} découpe`).not.toContain("slice(");
      expect(source, `${name} additionne`).not.toMatch(/\.reduce\s*\(/);
      expect(source, `${name} interroge la base`).not.toContain("prisma.");
    }
  });

  /** La page construit les liens, et ils portent la plage exacte du seau. */
  it("le lien d'un point porte les bornes du seau", () => {
    expect(page).toMatch(/periode:\s*"libre"/);
    expect(page).toContain("du: point.bucket.fromKey");
    expect(page).toContain("au: point.bucket.toKey");
    // Et la version par canal ajoute le canal, sinon le clic en vue « Par
    // canal » ouvrirait la liste de toute la période.
    expect(page).toMatch(/canal:\s*channel/);
  });
});

/* -------------------------------------------- les trois réglages dans l'URL */

describe("les trois réglages vivent dans l'URL", () => {
  it("la barre d'outils écrit metric, vue et pas", () => {
    for (const key of ["metric", "vue", "pas"]) {
      expect(toolbar, key).toContain(`write("${key}"`);
    }
    // Elle écrit dans l'URL et ne reçoit aucun gestionnaire : une fonction ne
    // franchit pas la frontière serveur → client (jalon 12).
    expect(toolbar).toContain("useSearchParams");
    expect(toolbar).not.toMatch(/onChange\?:\s*\(/);
  });

  it("la page les relit depuis l'URL, avec un défaut sûr", () => {
    expect(page).toContain('toGranularity(readOne("pas"))');
    expect(page).toContain('toTimelineView(readOne("vue"))');
    expect(page).toContain('toTimelineMetric(readOne("metric"))');
  });

  it("les trois vocabulaires sont fermés", () => {
    expect(GRANULARITIES).toEqual(["jour", "semaine", "mois"]);
    expect(TIMELINE_VIEWS).toEqual(["total", "canal"]);
    // « Démos qualifiées » se compte sur l'histoire entière : une barre par
    // semaine n'aurait pas le sens qu'elle suggère.
    expect(TIMELINE_METRICS).toEqual(["messages", "new_contacted", "replies"]);
  });
});

/* ------------------------------------------- les canaux, pas que la couleur */

describe("les canaux ne se distinguent pas par la couleur seule", () => {
  it("chacun porte un motif de tiret et une forme de marqueur", () => {
    expect(BANDS).toHaveLength(OUTREACH_CHANNELS.length);
    const markers = BANDS.map((band) => band.marker);
    expect(new Set(markers).size, "deux canaux partagent une forme").toBe(markers.length);
    // Le premier canal porte le trait plein ; les cinq autres un motif propre.
    const dashes = BANDS.slice(1).map((band) => band.dash);
    expect(dashes.every((dash) => dash !== "")).toBe(true);
    expect(new Set(dashes).size, "deux canaux partagent un motif").toBe(dashes.length);
  });

  it("la légende rend le motif, pas seulement un carré de couleur", () => {
    expect(chart).toContain("strokeDasharray={band.dash}");
    expect(chart).toContain("aria-pressed");
  });

  it("les couleurs viennent des jetons de marque", () => {
    for (const band of BANDS) {
      expect(band.color, band.channel).toContain("var(--color-");
    }
  });

  /**
   * Vert au-dessus de la cible, neutre en dessous, **jamais rouge** : un retard
   * de cadence n'est pas une faute, et peindre en rouge la moitié d'une série
   * ferait fermer l'écran.
   */
  it("une barre sous la cible est neutre, pas rouge", () => {
    expect(plot).toMatch(/reached \? "var\(--color-win\)" : "var\(--color-brand-l\)"/);
    /*
      **Un jeton de rouge**, pas la sous-chaîne « red » : la première version de
      cette assertion accusait `points.reduce(` de peindre en rouge. Une garde
      qui attrape un mot dans un autre mot n'apprend rien et finit par être
      désactivée.
    */
    expect(plot).not.toMatch(/var\(--color-(red|danger)|#(f{2}0{4}|e[0-9a-f]{5})|\bred-[1-9]/i);
  });
});

/* ---------------------------------------------------- l'infobulle au focus - */

describe("l'infobulle dit tout, et s'atteint au clavier", () => {
  it("porte les cinq informations du jalon", () => {
    for (const hook of [
      "data-tooltip-dates",
      "data-tooltip-total",
      "data-tooltip-target",
      "data-tooltip-previous",
      "data-tooltip-channel",
      "data-tooltip-sources",
    ]) {
      expect(tooltip, hook).toContain(hook);
    }
  });

  /**
   * Les barres et les points sont des **liens** : tabuler les parcourt, donc le
   * focus est naturel et l'infobulle n'est pas réservée à la souris.
   */
  it("chaque barre et chaque point est un lien nommé", () => {
    // Les deux balises sont désormais sur plusieurs lignes : on cherche l'URL
    // qu'elles portent, pas leur mise en forme.
    expect(plot).toMatch(/href=\{point\.href\}/);
    expect(plot).toMatch(/href=\{point\.channelHref\[channel\]/);
    const labels = plot.match(/aria-label=/g) ?? [];
    expect(labels.length).toBeGreaterThanOrEqual(3);
    /*
      **Et le focus pose l'infobulle, pas seulement le survol.** Ma première
      version documentait `onFocus` sans l'écrire : le commentaire promettait un
      graphique lisible au clavier et le code ne l'était pas. Le test de
      navigateur l'a attrapé, et cette garde empêche la régression silencieuse.
    */
    const focuses = plot.match(/onFocus=\{\(\) => onEnter\(/g) ?? [];
    expect(focuses.length, "une des deux vues n'écoute pas le focus").toBe(2);
  });

  it("les écarts et les parts sont écrits par le domaine", () => {
    expect(tooltip).toContain("gapLabel(");
    expect(tooltip).toContain("shareLabel(");
    expect(domain).toContain("export function gapLabel");
    expect(domain).toContain("export function shareLabel");
  });
});

/* ------------------------------------------------------- 390 px, et la plage */

describe("la forme de l'écran", () => {
  /**
   * Le défilement reste **dans le cadre** : la page elle-même ne défile jamais
   * horizontalement (jalon 46).
   */
  it("le graphique défile dans son propre cadre", () => {
    expect(chart).toContain("overflow-x-auto");
    expect(chart).toContain("data-timeline-frame");
  });

  it("la plage retire la course de zéros du début, et garde ceux du milieu", () => {
    expect(page).toContain("trimLeadingEmpty(");
    expect(domain).toMatch(/export function trimLeadingEmpty[\s\S]{0,600}findIndex/);
    // Les seaux couvrent la plage sans trou : un creux reste visible.
    expect(domain).toMatch(/export function bucketsBetween[\s\S]{0,900}nextBucket\(/);
  });

  it("la bande de cadence répartit la cible sur cinq jours, pas sept", () => {
    expect(domain).toContain("weeklyTarget / 5");
    expect(pace).toContain("data-pace-sentence");
  });
});

/* ------------------------------------- partie 1 : les dates, et la reprise - */

describe("partie 1 — les dates et la reprise", () => {
  /**
   * **Une seule écriture de la date d'un événement lemlist**, et elle prend la
   * date de l'activité. Le fichier le dit, et ce test échoue si une version
   * future retombe sur l'instant de l'import.
   */
  it("un événement lemlist est daté de son activité, jamais de l'import", () => {
    const sync = read("lib/api/lemlist-sync.ts");
    expect(sync).toContain("occurredAt: activity.occurredAt");
    expect(sync).not.toMatch(/occurredAt:\s*new Date\(\)/);
    expect(sync).not.toMatch(/occurredAt:\s*now\b/);

    // Et la date vient de `createdAt` de l'activité, avec refus si illisible.
    const lemlist = read("lib/domain/lemlist.ts");
    expect(lemlist).toMatch(/const occurredAt = new Date\(str\(source, "createdAt"\)\)/);
    expect(lemlist).toMatch(/Number\.isNaN\(occurredAt\.getTime\(\)\)\) return null/);
  });

  /** Une ligne déjà importée se corrige ; elle ne se duplique pas. */
  it("la resynchronisation répare une date fausse", () => {
    const sync = read("lib/api/lemlist-sync.ts");
    expect(sync).toMatch(/async function repairEvent/);
    expect(sync).toContain("if (await repairEvent(activity)) repaired += 1;");
    // Elle ne touche ni le contact ni le type : un rapprochement tranché à la
    // main ne doit pas être défait par une synchronisation.
    expect(sync).toMatch(/repairEvent[\s\S]{0,1400}prisma\.outreachEvent\.update/);
    const body = sync.slice(sync.indexOf("async function repairEvent"));
    const fn = body.slice(0, body.indexOf("\n}"));
    expect(fn).not.toContain("contactId");
    expect(fn).not.toMatch(/\btype\b\s*:/);
  });

  /**
   * **La reprise doit avoir un bouton.** Elle est restée deux jalons sans
   * appelant — ni cron, ni workflow, ni démarrage, ni écran —, et c'est pour
   * cette seule raison que septembre était vide en production.
   */
  it("la reprise du CRM est atteignable depuis /reglages", () => {
    const panel = readAll("components/settings/backfill-panel.tsx");
    expect(panel).toContain('fetch("/api/outreach/backfill"');
    expect(panel).toContain("data-backfill-run");
    // Les comptes avant et après, type par type : « 33 événements » sans dire
    // lesquels n'apprend rien.
    expect(panel).toContain("data-backfill-after");
    expect(panel).toContain("data-backfill-written");

    const settings = readAll("app/(crm)/reglages/page.tsx");
    expect(settings).toContain("<BackfillPanel />");
  });
});
