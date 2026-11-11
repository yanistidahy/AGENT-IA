import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { TABS } from "@/lib/domain/board-links";

/**
 * **Le pilotage en quatre onglets, et les quatre promesses qu'on ne voit pas.**
 *
 * Statique, comme la garde du jalon 109, parce que les défauts visés le sont :
 * un seuil recopié, un `n` oublié sous un taux, une série distinguée par la
 * seule couleur, une tranche décidée deux fois. Aucun ne lève, aucun ne fait
 * échouer un type, et chacun ne se voit qu'en comparant deux écrans à l'œil.
 *
 * Les commentaires sont retirés avant examen : ce projet documente ce qu'il
 * s'interdit, et une garde naïve attraperait sa propre documentation (leçon du
 * jalon 52, payée deux fois au jalon 112).
 */

const ROOT = path.join(__dirname, "..");

function strip(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const read = (file: string) => strip(readFileSync(path.join(ROOT, file), "utf8"));

function filesIn(relative: string): string[] {
  const dir = path.join(ROOT, relative);
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const next = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) out.push(...filesIn(next));
    else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) out.push(next);
  }
  return out;
}

/** L'onglet → le fichier de page qui le sert. */
const PAGE_OF: Readonly<Record<string, string>> = {
  "/pilotage": "app/(crm)/pilotage/page.tsx",
  "/pilotage/temps": "app/(crm)/pilotage/temps/page.tsx",
  "/pilotage/segments": "app/(crm)/pilotage/segments/page.tsx",
  "/pilotage/campagnes": "app/(crm)/pilotage/campagnes/page.tsx",
};

describe("les quatre onglets existent et se nomment", () => {
  it("a un fichier par onglet déclaré, et pas un onglet sans fichier", () => {
    // Sans cette boucle, ajouter un onglet à `TABS` produirait une 404 que
    // personne ne verrait avant de cliquer.
    expect(Object.keys(PAGE_OF)).toHaveLength(TABS.length);
    for (const tab of TABS) {
      const file = PAGE_OF[tab.href];
      expect(file, `${tab.href} n'a pas de page`).toBeDefined();
      expect(existsSync(path.join(ROOT, file!)), file).toBe(true);
    }
  });

  it("rend la barre d'onglets en se désignant comme l'onglet actif", () => {
    for (const [href, file] of Object.entries(PAGE_OF)) {
      const source = read(file);
      expect(source, `${file} : pas de barre d'onglets`).toContain("<BoardTabs");
      expect(source, `${file} : ne se déclare pas actif`).toContain(`active="${href}"`);
    }
  });

  it("rend la barre de filtres sur les quatre : un onglet sans filtres mentirait", () => {
    for (const file of Object.values(PAGE_OF)) {
      expect(read(file), file).toContain("<FilterBar");
    }
  });

  /** Les filtres suivent, et c'est `tabHref` qui le garantit (test unitaire). */
  it("fait passer les liens d'onglet par tabHref", () => {
    expect(read("components/pilotage/board-tabs.tsx")).toContain("tabHref(params, tab.href)");
  });
});

/* --------------------------------------------- un seuil, un seul endroit --- */

describe("aucun seuil n'est écrit deux fois", () => {
  const FILES = [
    ...filesIn("app/(crm)/pilotage"),
    ...filesIn("components/pilotage"),
    "lib/api/pilotage.ts",
    "lib/api/pilotage-view.ts",
    "lib/domain/pilotage.ts",
    "lib/domain/segments.ts",
    "lib/domain/campaigns-board.ts",
  ];

  /**
   * **Les bornes de tranche vivent dans `size-buckets.ts` et nulle part
   * ailleurs.**
   *
   * C'est `no-duplicate-thresholds` du jalon 7 appliqué aux tailles : un
   * 15 000 recopié dans un écran, et deux cartes finissent par ranger la même
   * marque dans deux populations différentes. La garde cherche les littéraux
   * dans les deux écritures que TypeScript accepte (`15000` et `15_000`).
   */
  it("ne recopie aucune borne de visiteurs hors de size-buckets.ts", () => {
    for (const file of FILES) {
      const source = read(file);
      for (const bound of ["2000", "2_000", "10000", "10_000", "15000", "15_000"]) {
        expect(source, `${file} : la borne ${bound} est décidée par sizeBucketOf()`).not.toContain(
          bound,
        );
      }
    }
  });

  /**
   * **Les deux seuils d'échantillon aussi.** Un `< 30` écrit dans une vue
   * deviendrait un second avis sur ce qu'un taux vaut, et c'est précisément la
   * question que ce jalon tranche une fois.
   */
  it("ne recopie aucun seuil d'échantillon : tout passe par reliabilityOf()", () => {
    /*
      La comparaison doit porter sur un **effectif**, pas sur n'importe quel
      nombre : ma première version accusait `slot >= 30` dans le tracé, qui est
      une largeur en pixels. Une garde qui attrape de la géométrie n'apprend
      rien et finit par être désactivée — la leçon du `points.reduce(` pris pour
      du rouge au jalon 113.
    */
    const SAMPLE = /\b(n|count|contacted|people|sample|replied|echantillon)\s*[<>]=?\s*(10|30)\b/i;
    for (const file of FILES) {
      expect(read(file), `${file} : un seuil d'échantillon écrit à la main`).not.toMatch(SAMPLE);
    }
  });
});

/* ------------------------------------- chaque taux porte son échantillon --- */

describe("chaque taux porte son n", () => {
  /**
   * **La promesse du brief, vérifiée sur les quatre onglets.**
   *
   * « 12 % » affiché pareil sur neuf personnes et sur trois cents est la façon
   * la plus courante de tromper quelqu'un avec un chiffre exact. La règle ne
   * vaut que si elle tient sur l'écran où l'on a oublié de l'appliquer — d'où
   * une garde et non une relecture.
   */
  const SHOWS_RATES = [
    "app/(crm)/pilotage/page.tsx",
    "components/pilotage/size-cards.tsx",
    "components/pilotage/niche-table.tsx",
    "components/pilotage/campaign-board.tsx",
  ];

  it("affiche la puce de fiabilité partout où un taux est rendu", () => {
    for (const file of SHOWS_RATES) {
      /*
        `<ReliabilityChip` et non `ReliabilityChip` : ma première version
        passait tant que l'import existait, même après avoir retiré la puce de
        l'écran. Une garde satisfaite par une ligne d'import ne vérifie rien.
      */
      expect(read(file), `${file} : un taux sans sa fiabilité`).toContain("<ReliabilityChip");
    }
  });

  it("fait venir le vocabulaire de fiabilité du domaine", () => {
    const chip = read("components/pilotage/reliability-chip.tsx");
    expect(chip).toContain("RELIABILITY_LABELS");
    expect(chip).toContain("@/lib/domain/size-buckets");
    // Et la puce ne décide pas elle-même de l'état : elle le reçoit.
    expect(chip).not.toContain("reliabilityOf(");
  });

  /** L'état illisible porte des hachures, pas seulement une teinte. */
  it("ne distingue pas l'échantillon illisible par la couleur seule", () => {
    const chip = read("components/pilotage/reliability-chip.tsx");
    expect(chip).toContain("data-hatch");
    expect(chip).toContain("repeating-linear-gradient");
  });
});

/* ------------------------------------- la couleur n'est jamais seule ------- */

describe("les séries ne se distinguent pas par la couleur seule", () => {
  it("la courbe des deux tranches porte un tiret et une forme", () => {
    const page = read("app/(crm)/pilotage/segments/page.tsx");
    expect(page).toContain('marker: "circle"');
    expect(page).toContain('marker: "square"');
    expect(page).toMatch(/dash:\s*"6 4"/);
    const plot = read("components/pilotage/rate-evolution.tsx");
    expect(plot).toContain("strokeDasharray={line.dash}");
  });

  it("les barres de la seconde tranche sont hachurées", () => {
    expect(read("app/(crm)/pilotage/segments/page.tsx")).toContain('value.bucket === "large"');
    expect(read("components/pilotage/contacted-bars.tsx")).toContain("contacted-hatch");
  });

  it("les couleurs viennent des jetons, jamais d'une valeur écrite dans l'écran", () => {
    for (const file of [
      "app/(crm)/pilotage/segments/page.tsx",
      "components/pilotage/contacted-bars.tsx",
      "components/pilotage/rate-evolution.tsx",
    ]) {
      // Pas de `#rrggbb` : on change la couleur à la source (jalon 23).
      expect(read(file), `${file} : une couleur écrite en dur`).not.toMatch(/#[0-9a-f]{6}\b/i);
    }
  });
});

/* ----------------------------------------- le fond et les cartes du proto -- */

describe("la langue visuelle du prototype", () => {
  it("déclare le fond et la seconde série comme jetons", () => {
    const css = readFileSync(path.join(ROOT, "app/globals.css"), "utf8");
    expect(css).toContain("--color-board: #f5f6fa");
    expect(css).toContain("--color-accent-2: #c2410c");
    expect(css).toContain("--radius-board: 16px");
  });

  it("pose le fond du tableau de bord sur les quatre onglets", () => {
    for (const file of Object.values(PAGE_OF)) {
      expect(read(file), `${file} : pas sur le fond du tableau de bord`).toContain("bg-board");
    }
  });

  /**
   * **Le texte secondaire posé sur ce fond est `closed`, pas `muted`.**
   *
   * Mesuré : `muted` donne 4.42:1 sur `#F5F6FA` — sous le seuil AA —, alors
   * qu'il tient 4.77:1 sur blanc. Même nature de piège qu'au jalon 30, où
   * `muted` sur `paper` tombait à 4.15:1 en portant la colonne Statut.
   */
  it("n'utilise pas le gris clair sur le fond du tableau de bord", () => {
    for (const file of [
      "components/pilotage/board-header.tsx",
      "components/pilotage/board-tabs.tsx",
    ]) {
      expect(read(file), `${file} : muted sur le fond board`).not.toContain("text-muted");
      expect(read(file)).toContain("text-closed");
    }
  });
});

/* --------------------------------------- lemlist : étape et profil -------- */

describe("ce que la synchronisation lemlist garde en plus", () => {
  it("convertit l'index d'étape indexé à zéro en rang affiché", () => {
    const domain = read("lib/domain/lemlist.ts");
    // `sequenceStep` est indexé à zéro : c'est écrit dans la documentation de
    // GET /activities, et un décalage d'une unité attribuerait à l'étape 2 ce
    // que l'étape 3 a produit.
    expect(domain).toContain('source["sequenceStep"]');
    expect(domain).toContain("rawStep + 1");
  });

  it("écrit l'étape dans le journal", () => {
    expect(read("lib/api/lemlist-sync.ts")).toContain("stepIndex: activity.stepIndex");
    expect(read("lib/api/outreach-events.ts")).toContain("stepIndex: input.stepIndex");
  });

  /**
   * **Et la remplit sur les lignes déjà importées.**
   *
   * Les deux colonnes sont arrivées à ce jalon : tout l'historique est à `null`.
   * Sans réparation, l'onglet Campagnes afficherait « hors séquence » sur tout
   * le passé pour l'éternité — la contrainte d'unicité empêche de réécrire la
   * ligne. Mesuré en recette : une ligne remise à `null` reçoit `stepIndex 1` au
   * passage suivant, comptée `repaired: 1`.
   */
  it("répare l'étape d'une ligne déjà importée, sans jamais l'effacer", () => {
    const sync = read("lib/api/lemlist-sync.ts");
    expect(sync, "repairEvent ne lit pas l'étape").toContain("stepIndex: true, stepType: true");
    // Jamais de remplacement par du vide : un `null` chez lemlist veut dire
    // « pas née d'une étape », pas « oublie ce que tu savais ».
    expect(sync).toContain("activity.stepIndex !== null && known.stepIndex !== activity.stepIndex");
    expect(sync).toContain('activity.stepType !== "" && known.stepType !== activity.stepType');
  });

  /**
   * **Et n'écrase jamais une valeur du CRM.** La décision passe par
   * `syncMayWrite` : une condition recopiée dans le service finirait par
   * diverger de celle du domaine, et la divergence serait invisible — on ne
   * voit pas une valeur qui a été remplacée.
   */
  it("passe par syncMayWrite pour le profil de la marque", () => {
    const sync = read("lib/api/lemlist-sync.ts");
    expect(sync).toContain("syncMayWrite(");
    expect(sync).toContain('patch.nicheSource = "lemlist"');
    expect(sync).toContain('patch.visitorsSource = "lemlist"');
  });

  it("marque « crm » ce qui est saisi dans le CRM", () => {
    const companies = read("lib/api/companies.ts");
    expect(companies).toContain('nicheSource: cleanNiche(input.niche ?? "") === "" ? "" : "crm"');
    expect(companies).toContain('data.visitorsSource = input.monthlyVisitors === null ? "" : "crm"');
  });
});

/* ------------------------------------- onglet 4 : le tri et les colonnes --- */

describe("les campagnes côte à côte se trient", () => {
  const board = read("components/pilotage/campaign-board.tsx");
  const page = read("app/(crm)/pilotage/campagnes/page.tsx");

  /**
   * **Un vrai tableau, parce que `aria-sort` n'a pas d'autre endroit où vivre.**
   *
   * L'attribut se pose sur un `<th>` et sur rien d'autre : une liste de cartes
   * triable serait un tri que seule la souris peut voir. La garde vérifie donc
   * la balise *et* l'attribut — l'une sans l'autre ne tient pas la promesse.
   */
  it("rend un tableau dont chaque en-tête annonce son tri", () => {
    expect(board).toContain("<table");
    expect(board).toContain("<caption");
    expect(board).toContain("aria-sort={ariaSort(");
    // Les trois valeurs de l'attribut, et pas seulement celle de la colonne
    // active : « none » sur les autres est ce qui dit qu'elles sont triables.
    expect(board).toContain('"ascending"');
    expect(board).toContain('"descending"');
    expect(board).toContain('"none"');
  });

  /**
   * **Les en-têtes sont des liens, et le tri vit dans l'URL.** Un `onClick`
   * ferait de cet onglet un composant client et rendrait la vue triée
   * impartageable — la règle du jalon 1.
   */
  it("fait du tri un lien, pas un bouton", () => {
    expect(board).toContain("<Link");
    expect(board, "un tri qui ne survit pas au rechargement").not.toContain("onClick");
    expect(page).toContain('one(params, "tri")');
    expect(page).toContain('one(params, "sens")');
    expect(page).toContain("toBoardSort(");
    expect(page).toContain("toSortDir(");
  });

  /**
   * **Le sens se lit aussi sans la couleur.** La flèche se voit, `aria-sort` se
   * dit : une seule des deux ferait une direction que la moitié des gens ne peut
   * pas lire — la règle « jamais la couleur seule », appliquée à un tri.
   */
  it("montre le sens par une flèche, pas par une teinte", () => {
    expect(board).toMatch(/[↑]/);
    expect(board).toMatch(/[↓]/);
  });

  it("n'ordonne pas lui-même : le tri est demandé au domaine", () => {
    // La vue reçoit des lignes déjà triées. Un `.sort(` ici serait un second
    // avis sur l'ordre, et les valeurs absentes y remonteraient en tête.
    expect(board, "la vue trie elle-même").not.toContain(".sort(");
    expect(page).toContain("sort={sort}");
    expect(page).toContain("dir={dir}");
    expect(page).toContain("sortHref={sortHref}");
  });

  /**
   * **« Invitations acceptées » est une colonne, et son chiffre ouvre sa liste.**
   *
   * Une invitation acceptée n'est pas une réponse : elle a sa colonne et son
   * indicateur (`invites_accepted`), donc le nombre affiché est la longueur de la
   * liste qu'il ouvre — l'invariant du jalon 109 étendu aux deux colonnes
   * d'invitation.
   */
  it("ouvre la liste des invitations acceptées depuis sa colonne", () => {
    expect(board).toContain('label: "Invitations acceptées"');
    expect(board).toContain('column: "accepted"');
    expect(page).toContain('accepted: "invites_accepted"');
    expect(page).toContain('invites: "invites"');
    const metrics = read("lib/domain/pilotage.ts");
    expect(metrics).toContain('"invites_accepted"');
    // Et le chiffre comme la liste viennent de `inviteAcceptance` : deux
    // `filter` identiques feraient deux définitions, donc deux nombres.
    expect(metrics).toContain("inviteAcceptance(rows).accepted");
    expect(read("lib/domain/campaigns-board.ts")).toContain("invites.accepted.length");
  });

  it("porte une puce d'état et une puce d'origine par campagne", () => {
    expect(board).toContain("data-board-state");
    expect(board).toContain("data-board-origin");
    expect(board).toContain("BOARD_STATE_LABELS[line.state]");
    // L'état relevé et l'état déduit ne se lisent pas pareil, et l'écran le dit.
    expect(board).toContain("line.reportedState");
  });

  /**
   * **La phrase de pause est écrite par le domaine.** `pausedNotice` décide des
   * trois silences (pas en pause, compte inconnu, personne en attente) ; la
   * recomposer dans la vue en ferait une seconde règle, et « 0 prospect attend »
   * finirait par s'afficher sur une campagne dont on n'a rien relevé.
   */
  it("fait venir la phrase de pause du domaine, avec son compte", () => {
    const steps = read("components/pilotage/campaign-steps.tsx");
    expect(steps).toContain("line.notice");
    expect(steps).toContain("data-board-paused");
    expect(steps).toContain("data-waiting");
    expect(steps, "la phrase est recomposée dans la vue").not.toContain("Campagne en pause");
    const domain = read("lib/domain/campaigns-board.ts");
    expect(domain).toContain("Campagne en pause :");
    expect(domain).toContain("pausedNotice(");
    // Le compte vient du relevé, pas d'un repli à zéro.
    expect(domain).toContain("waitingToLaunch(");
    expect(read("lib/api/pilotage.ts")).toContain("reportedCampaigns");
  });
});

/* ----------------------------------- le compteur manuel, et le téléphone --- */

describe("le compteur manuel sur un téléphone", () => {
  const page = read("app/(crm)/pilotage/page.tsx");

  /**
   * **Un seul compteur dans le document.**
   *
   * Le réflexe serait d'en rendre deux et d'en masquer un par point de rupture.
   * Ce seraient deux blocs d'état client, deux `localStorage`, deux listes
   * d'annulation — et un « +1 » cliqué dans l'un que l'autre ne verrait pas. La
   * garde compte les occurrences : elle attrape le doublon, pas l'intention.
   */
  it("ne rend qu'un seul bloc de compteur", () => {
    const uses = page.match(/<ManualCounter/g) ?? [];
    expect(uses, "deux compteurs se contrediraient").toHaveLength(1);
  });

  /**
   * **Et c'est `order` qui le déplace, pas un second rendu.** Premier sous
   * 768 px — le point de rupture que le brief nomme —, à sa place au-dessus, où
   * la mise en page du bureau ne doit pas bouger.
   */
  it("le remonte en tête sous 768 px, et le laisse en place au-dessus", () => {
    expect(page).toContain("order-first md:order-none");
    // Le bloc reste à côté de l'entonnoir sur grand écran, placé explicitement :
    // une grille qui compterait sur l'ordre du document le mettrait ailleurs.
    expect(page).toContain("xl:col-start-2 xl:row-start-3");
    expect(page).toContain("xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]");
    // Et jamais par un bloc masqué : `hidden md:block` sur un compteur voudrait
    // dire qu'il en existe un second.
    expect(page, "un compteur masqué par point de rupture").not.toMatch(
      /hidden\s+(md|sm|lg|xl):(block|flex|grid)/,
    );
  });
});
