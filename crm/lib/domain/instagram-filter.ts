/**
 * **Le segment Instagram, en deux axes plutôt qu'en une liste de cas.**
 *
 * ## Pourquoi deux paramètres et non trois puces de plus
 *
 * Le jalon 48 avait fait de « DM envoyé » et « pas encore de DM » deux valeurs
 * d'un même filtre à valeur unique. Ça marche tant qu'on ne pose qu'une
 * question. Or il y en a **deux, et elles sont indépendantes** :
 *
 * | | DM envoyé | Pas de DM |
 * |---|---|---|
 * | **Compte connu** | déjà approché | ← *la file du matin* |
 * | **Compte inconnu** | (rare : DM sans avoir noté le compte) | rien à faire encore |
 *
 * Énumérer les croisements comme valeurs d'un seul filtre en demanderait quatre
 * aujourd'hui, huit si un troisième axe arrive — et chacun serait une valeur
 * d'URL à nommer, à traduire en SQL, à tester. Deux paramètres indépendants
 * donnent **les quatre croisements sans en nommer aucun**, et chacun se traduit
 * par une seule clause.
 *
 * C'est aussi ce qui rend possible la case qui manquait : `?compte=connu&dm=aucun`
 * — le compte est trouvé, le message reste à écrire.
 *
 * ## Ce que chaque axe lit, et pourquoi ce n'est pas la même chose
 *
 * - **`compte`** lit le champ `Contact.instagram` : on sait **où** écrire ;
 * - **`dm`** lit les interactions de type `instagram` : on a **écrit**.
 *
 * La distinction est celle du jalon 48, et c'est elle qui donne son sens à
 * l'intersection : la file du matin, ce sont les fiches où le premier est vrai
 * et le second faux.
 */

export const ACCOUNT_STATES = ["connu", "inconnu"] as const;
export type AccountState = (typeof ACCOUNT_STATES)[number];

export const DM_STATES = ["envoye", "aucun"] as const;
export type DmState = (typeof DM_STATES)[number];

export function toAccountState(value: string | undefined): AccountState | undefined {
  return ACCOUNT_STATES.find((state) => state === value);
}

export function toDmState(value: string | undefined): DmState | undefined {
  return DM_STATES.find((state) => state === value);
}

/**
 * Les entrées du menu de la puce « Instagram ».
 *
 * Elles ne sont pas les axes : ce sont les **quatre lectures qui servent**,
 * exprimées comme des couples. Le menu propose des intentions (« ma file du
 * matin »), l'URL porte des faits (`compte=connu&dm=aucun`) — et n'importe
 * quelle autre combinaison reste atteignable à la main sans qu'on ait eu à la
 * prévoir ici.
 */
export interface InstagramPreset {
  readonly key: string;
  readonly label: string;
  /** Ce que la puce affiche quand ce préréglage est actif. */
  readonly short: string;
  readonly account?: AccountState;
  readonly dm?: DmState;
  /** Une phrase quand le compteur est à zéro — dire la règle, pas le vide. */
  readonly empty: string;
}

export const INSTAGRAM_PRESETS: readonly InstagramPreset[] = [
  {
    key: "a-dm",
    label: "Compte connu, à DM",
    short: "à DM",
    account: "connu",
    dm: "aucun",
    empty:
      "Aucune marque en attente de DM : soit le compte n'est pas encore noté sur la fiche, soit le message est déjà parti.",
  },
  {
    key: "compte",
    label: "Compte Instagram",
    short: "compte connu",
    account: "connu",
    empty:
      "Aucune fiche ne porte de compte Instagram. Le champ se remplit sur la fiche du contact, à côté du site et de LinkedIn.",
  },
  {
    key: "envoye",
    label: "DM envoyé",
    short: "DM envoyé",
    dm: "envoye",
    empty:
      "Aucun DM Instagram consigné. Connaître le compte d'une marque ne suffit pas : c'est en consignant l'échange, avec le type « Instagram », que la fiche entre dans ce segment.",
  },
  {
    key: "aucun",
    label: "Pas encore de DM",
    short: "sans DM",
    dm: "aucun",
    empty: "Toutes les fiches actives ont reçu un DM Instagram.",
  },
];

/** Le préréglage correspondant à l'état courant de l'URL, s'il en existe un. */
export function activePreset(
  account: AccountState | undefined,
  dm: DmState | undefined,
): InstagramPreset | null {
  if (account === undefined && dm === undefined) return null;
  return (
    INSTAGRAM_PRESETS.find(
      (preset) => preset.account === account && preset.dm === dm,
    ) ?? null
  );
}

/**
 * Le libellé de la puce quand un couple actif ne correspond à aucun préréglage.
 *
 * Ce cas n'arrive que par URL écrite à la main — mais il ne doit pas produire
 * une puce muette : une liste filtrée dont rien ne nomme le filtre est un écran
 * qui ment, et c'est la règle posée au jalon 31 pour le filtre orphelin.
 */
export function describeCombination(
  account: AccountState | undefined,
  dm: DmState | undefined,
): string {
  const parts: string[] = [];
  if (account !== undefined) {
    parts.push(account === "connu" ? "compte connu" : "compte inconnu");
  }
  if (dm !== undefined) parts.push(dm === "envoye" ? "DM envoyé" : "sans DM");
  return parts.join(" · ");
}

/** Compteurs des quatre préréglages, calculés sur tout le portefeuille. */
export type InstagramCounts = Readonly<Record<string, number>>;

/**
 * Les paramètres d'URL qu'écrit la puce, nommés **ici** et non dans le composant.
 *
 * Le nom du paramètre est un contrat entre trois fichiers : la puce l'écrit, le
 * schéma Zod l'accepte, la page le relit. Écrit à la main dans le composant, il
 * s'est trompé une fois — `compte` contre `account` — et rien ne l'a signalé :
 * un paramètre inconnu est ignoré, la liste revient entière, et la puce s'allume
 * quand même. Le rendre exportable, c'est le rendre testable contre le schéma.
 *
 * `null` efface le paramètre ; les deux puces de relance sont remises à zéro
 * parce que les états Instagram et les relances sont deux questions distinctes.
 */
export function presetParams(
  preset: InstagramPreset | null,
): Record<string, string | null> {
  return {
    account: preset?.account ?? null,
    dm: preset?.dm ?? null,
    followUp: null,
    incomplete: null,
  };
}
