/**
 * **La file du matin, groupée.**
 *
 * Une file rendue comme une suite de lignes se lit ligne à ligne : pour savoir
 * ce qu'on regarde, il faut relire la métadonnée de chaque carte. Grouper
 * répond à la question une fois par groupe, et c'est le seul gain qui compte
 * ici — le reste est de la mise en page.
 *
 * **Par campagne, pas par échéance.** Les deux étaient possibles ; la campagne
 * gagne parce que c'est elle qui décide du discours, de la boîte d'envoi et du
 * signataire : deux brouillons de la même campagne se relisent avec le même
 * œil, deux brouillons dus le même jour n'ont rien en commun. Et parce que la
 * file est **déjà** celle du jour (jalon 38) : grouper par échéance produirait
 * presque toujours un seul groupe.
 *
 * Pur, comme tout `lib/domain/` : l'ordre et les libellés se vérifient sans
 * navigateur, et c'est ce qui permet au test de comparer ce que l'écran rend à
 * ce que la règle dit.
 */

export interface GroupableDeparture {
  readonly id: string;
  readonly campaignName: string;
  readonly sequenceName: string;
  readonly step: number;
  readonly status: string;
}

export interface DepartureGroup<T extends GroupableDeparture> {
  /** Clé stable pour le rendu : le nom du groupe suffit, il est unique ici. */
  readonly key: string;
  readonly title: string;
  readonly rows: readonly T[];
}

/**
 * Le nom du groupe d'un départ.
 *
 * La campagne d'abord, la séquence en repli : une séquence a toujours un nom,
 * une campagne peut manquer sur les séquences d'avant le jalon 54.
 */
export function groupTitle(row: GroupableDeparture): string {
  const campaign = row.campaignName.trim();
  if (campaign !== "") return campaign;
  const sequence = row.sequenceName.trim();
  return sequence === "" ? "Sans campagne" : sequence;
}

/**
 * Groupe en **conservant l'ordre reçu**.
 *
 * Le service trie déjà la file (échéance, puis contact) : re-trier ici
 * inventerait un second ordre, et c'est toujours le second qui finit par
 * contredire l'écran. L'ordre des groupes est celui de leur première ligne.
 */
export function groupDepartures<T extends GroupableDeparture>(
  rows: readonly T[],
): DepartureGroup<T>[] {
  const groups: DepartureGroup<T>[] = [];
  const index = new Map<string, T[]>();

  for (const row of rows) {
    const title = groupTitle(row);
    const bucket = index.get(title);
    if (bucket === undefined) {
      const fresh: T[] = [row];
      index.set(title, fresh);
      groups.push({ key: title, title, rows: fresh });
    } else {
      bucket.push(row);
    }
  }

  return groups;
}

/**
 * Ce que l'en-tête de groupe annonce, à droite de son nom.
 *
 * Les brouillons non composés (`failed`) sont comptés **à part** : ils ne se
 * valident pas, ils se réparent, et les additionner aux autres ferait annoncer
 * « 5 à valider » là où deux ne partiront pas.
 */
export function describeGroup(rows: readonly GroupableDeparture[]): string {
  const failed = rows.filter((row) => row.status === "failed").length;
  const ready = rows.length - failed;
  const parts = [`${ready} à valider`];
  if (failed > 0) parts.push(`${failed} non composé${failed > 1 ? "s" : ""}`);
  return parts.join(" · ");
}

/** L'étape, dite comme une position dans la suite : « étape 2 sur 3 ». */
export function stepLabel(step: number, total: number): string {
  return total > 0 ? `étape ${step} sur ${total}` : `étape ${step}`;
}
