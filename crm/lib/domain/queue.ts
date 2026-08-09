/**
 * La file d'action, vue comme une structure plutôt que comme un écran.
 *
 * Le reproche auquel ce module répond est précis : dix cartes identiques
 * forcent dix décisions là où il n'y en a qu'une. Trois règles en sortent, et
 * elles sont testables sans navigateur.
 *
 * 1. **Les lignes se regroupent par société** quand plusieurs se partagent la
 *    même — six relances du même client sont une conversation, pas six ;
 * 2. **une action groupée n'est proposée que si elle s'applique à toute la
 *    sélection.** L'appliquer partiellement en silence est le genre de demi-
 *    action qu'on ne découvre qu'après coup ;
 * 3. **le déplacement au clavier suit ce qui est affiché**, replis compris — un
 *    curseur qui traverse des lignes invisibles est un curseur perdu.
 */

export type QueueGroup = "reminders" | "tasks" | "deals";

export const QUEUE_GROUPS: readonly QueueGroup[] = ["reminders", "tasks", "deals"];

export const QUEUE_GROUP_LABELS: Record<QueueGroup, string> = {
  reminders: "Relances dues",
  tasks: "Tâches en retard",
  deals: "Affaires bloquées",
};

/**
 * Ce que le regroupement et les actions ont besoin de savoir. Volontairement
 * plus étroit que `ActionRow` : le domaine n'a que faire du téléphone ni de la
 * dernière note.
 */
export interface QueueRowLike {
  readonly id: string;
  readonly group: QueueGroup;
  readonly company: string | null;
  readonly contactId: string | null;
  readonly taskId: string | null;
  readonly dealId: string | null;
}

export interface CompanyCluster<T> {
  /** Identifiant stable du repli, dérivé de la section et du nom. */
  readonly key: string;
  readonly company: string | null;
  readonly rows: readonly T[];
  /** Regroupé sous un en-tête repliable, ou rendu à plat. */
  readonly clustered: boolean;
}

export interface QueueSection<T> {
  readonly group: QueueGroup;
  readonly label: string;
  readonly count: number;
  readonly clusters: readonly CompanyCluster<T>[];
}

/** En dessous de deux lignes, un en-tête de société ajoute du bruit, pas du sens. */
const CLUSTER_MIN = 2;

export function buildSections<T extends QueueRowLike>(
  rows: readonly T[],
): readonly QueueSection<T>[] {
  const sections: QueueSection<T>[] = [];

  for (const group of QUEUE_GROUPS) {
    const inGroup = rows.filter((row) => row.group === group);
    if (inGroup.length === 0) continue;

    // `Map` conserve l'ordre d'insertion : les sociétés sortent dans l'ordre où
    // la première de leurs lignes apparaît, donc dans l'ordre d'urgence déjà
    // décidé par la lecture. Un tri alphabétique le détruirait.
    const byCompany = new Map<string, T[]>();
    for (const row of inGroup) {
      const key = row.company ?? "";
      byCompany.set(key, [...(byCompany.get(key) ?? []), row]);
    }

    const clusters: CompanyCluster<T>[] = [];
    for (const [company, members] of byCompany) {
      const clustered = company !== "" && members.length >= CLUSTER_MIN;
      if (clustered) {
        clusters.push({
          key: `${group}:${company}`,
          company,
          rows: members,
          clustered: true,
        });
        continue;
      }
      // Sans société, ou seule de sa société : chaque ligne reste autonome,
      // sinon un en-tête « (1) » viendrait s'intercaler pour rien.
      for (const row of members) {
        clusters.push({ key: `${group}:${row.id}`, company: row.company, rows: [row], clustered: false });
      }
    }

    sections.push({
      group,
      label: QUEUE_GROUP_LABELS[group],
      count: inGroup.length,
      clusters,
    });
  }

  return sections;
}

/**
 * Les identifiants réellement visibles, dans l'ordre de l'écran.
 *
 * C'est la seule liste sur laquelle `j` et `k` ont le droit de se déplacer : un
 * repli fermé cache ses lignes, et le curseur doit les enjamber.
 */
export function visibleOrder<T extends QueueRowLike>(
  sections: readonly QueueSection<T>[],
  collapsed: ReadonlySet<string>,
): readonly string[] {
  const order: string[] = [];
  for (const section of sections) {
    for (const cluster of section.clusters) {
      if (cluster.clustered && collapsed.has(cluster.key)) continue;
      for (const row of cluster.rows) order.push(row.id);
    }
  }
  return order;
}

/**
 * Déplacement du curseur.
 *
 * Ne boucle pas : arrivé en bas, `j` reste en bas. Un curseur qui revient en
 * tête sans prévenir fait recommencer un travail qu'on croyait fini.
 */
export function moveCursor(
  order: readonly string[],
  current: string | null,
  delta: number,
): string | null {
  if (order.length === 0) return null;
  const index = current === null ? -1 : order.indexOf(current);
  if (index === -1) return delta > 0 ? (order[0] ?? null) : (order[order.length - 1] ?? null);
  const next = Math.min(Math.max(index + delta, 0), order.length - 1);
  return order[next] ?? null;
}

/* ------------------------------------------------------ identité des lignes */

export type QueueTargetKind = "reminder" | "task" | "deal";

export interface QueueTarget {
  readonly kind: QueueTargetKind;
  /** Identifiant de l'enregistrement visé : contact, tâche ou affaire. */
  readonly ref: string;
}

/**
 * Relit l'identifiant d'une ligne de file.
 *
 * Les identifiants sont **auto-descriptifs** (`reminder-<contact>`) pour que le
 * serveur n'ait pas à refaire la lecture de la file pour savoir ce qu'on lui
 * demande de modifier. Le client n'envoie que des identifiants ; il ne dicte
 * jamais la table ni le champ.
 */
export function parseQueueId(id: string): QueueTarget | null {
  const separator = id.indexOf("-");
  if (separator <= 0) return null;
  const prefix = id.slice(0, separator);
  const ref = id.slice(separator + 1);
  if (ref === "") return null;
  if (prefix === "reminder" || prefix === "task" || prefix === "deal") {
    return { kind: prefix, ref };
  }
  return null;
}

/* --------------------------------------------------------- actions groupées */

export type BatchAction = "postpone-3" | "postpone-7" | "sequence" | "assign" | "lost" | "complete";

export const BATCH_LABELS: Record<BatchAction, string> = {
  "postpone-3": "Reporter à +3 j",
  "postpone-7": "Reporter à +7 j",
  sequence: "Lancer une séquence",
  assign: "Assigner",
  lost: "Marquer perdu",
  complete: "Consigner comme traité",
};

/** Ce dont chaque action a besoin sur **chacune** des lignes sélectionnées. */
function supports(row: QueueRowLike, action: BatchAction): boolean {
  switch (action) {
    case "postpone-3":
    case "postpone-7":
      // Une affaire en sommeil n'a ni échéance ni relance : on ne la reporte
      // pas, on la réveille — c'est une autre action, ailleurs.
      return row.taskId !== null || row.contactId !== null;
    case "assign":
      return row.taskId !== null || row.contactId !== null;
    case "sequence":
    case "lost":
      return row.contactId !== null;
    case "complete":
      return row.taskId !== null;
  }
}

export const BATCH_ACTIONS: readonly BatchAction[] = [
  "postpone-3",
  "postpone-7",
  "sequence",
  "assign",
  "lost",
  "complete",
];

/**
 * Les actions offertes pour une sélection donnée.
 *
 * **Toutes les lignes ou aucune.** Proposer « Marquer perdu » sur six lignes
 * dont deux sont des affaires, puis n'en traiter que quatre, produit un écran
 * qui ment sur ce qu'il vient de faire. Mieux vaut retirer le bouton et dire
 * pourquoi.
 */
export function batchActions(rows: readonly QueueRowLike[]): readonly BatchAction[] {
  if (rows.length === 0) return [];
  return BATCH_ACTIONS.filter((action) => rows.every((row) => supports(row, action)));
}

/** Ce qui bloque une action, pour l'expliquer plutôt que de la faire disparaître. */
export function blockedBy(rows: readonly QueueRowLike[], action: BatchAction): number {
  return rows.filter((row) => !supports(row, action)).length;
}

/** « 6 sélectionnés ». Le pluriel se décide ici, pas dans le JSX. */
export function selectionLabel(count: number): string {
  return count === 1 ? "1 sélectionné" : `${count} sélectionnés`;
}
