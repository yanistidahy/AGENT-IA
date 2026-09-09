/**
 * **La sélection de contacts d'une campagne, qui survit au filtrage.**
 *
 * C'est la contrainte qui décide de tout le reste : « je filtre sur Instagram,
 * j'en coche huit, puis je filtre sur le rôle et j'en coche cinq — les treize
 * doivent revenir ». Or filtrer, sur cet écran, est une **navigation** : la
 * page est rendue côté serveur et l'état React repart de zéro à chaque
 * changement de filtre. Une sélection en mémoire de composant serait donc
 * perdue exactement au moment où l'on en a besoin.
 *
 * Trois rangements possibles, et pourquoi celui-ci :
 *
 * | Où | Verdict |
 * |---|---|
 * | l'URL | **non** : cent cinquante identifiants dans la barre d'adresse, une limite de longueur, et un lien mis en favori qui fige une sélection périmée |
 * | la base | **non** : une sélection en cours de composition n'est pas un fait, et l'écrire ferait de chaque clic de case une écriture — c'est une inscription sans témoin, ce que le jalon 8 s'interdit |
 * | `sessionStorage` | **retenu** : per-onglet, survit à la navigation, disparaît à la fermeture — exactement la durée de vie d'un brouillon de sélection |
 *
 * La clé porte l'identifiant de campagne : deux campagnes composées dans deux
 * onglets ne se mélangent pas. Toutes les lectures et écritures sont gardées —
 * un navigateur en navigation privée, ou qui refuse le stockage, doit rendre
 * l'écran utilisable plutôt que le casser : on retombe alors sur une sélection
 * qui ne survit pas au filtre, dégradée mais jamais fausse.
 */

const PREFIX = "auraflow:campaign-selection:";

function keyFor(campaignId: string): string {
  return `${PREFIX}${campaignId}`;
}

/** La sélection mémorisée, ou l'ensemble vide si le stockage est indisponible. */
export function readSelection(campaignId: string): Set<string> {
  try {
    const raw = window.sessionStorage.getItem(keyFor(campaignId));
    if (raw === null) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

export function writeSelection(campaignId: string, ids: ReadonlySet<string>): void {
  try {
    window.sessionStorage.setItem(keyFor(campaignId), JSON.stringify([...ids]));
  } catch {
    // Stockage refusé : la sélection vit alors le temps de la page. L'écran
    // reste utilisable, il perd seulement sa mémoire d'un filtre à l'autre.
  }
}

export function clearSelection(campaignId: string): void {
  try {
    window.sessionStorage.removeItem(keyFor(campaignId));
  } catch {
    // Rien à faire : il n'y avait rien à effacer.
  }
}
