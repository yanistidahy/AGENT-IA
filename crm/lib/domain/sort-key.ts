import { fold } from "./text";

/**
 * La clé de tri alphabétique — **pliée, et nulle quand il n'y a rien**.
 *
 * ### Pourquoi ni `searchText`, ni la collation du serveur
 *
 * **`searchText` ne peut pas servir** : il concatène tous les champs
 * cherchables d'une fiche — pour une société, nom + domaine + secteur + ville ;
 * pour un contact, prénom + nom + adresse + société. Trier dessus classerait
 * « Alpha » (à Lyon) d'après « alpha lyon », donc mêlerait au nom des valeurs
 * qui n'ont rien à voir avec l'ordre alphabétique demandé. Il est fait pour
 * `contains`, pas pour `ORDER BY`.
 *
 * **La collation du serveur ne peut pas servir non plus**, et c'est mesuré :
 * cette base tourne en `C.UTF-8`, où l'ordre est celui des octets. Vérifié —
 * « ELIXIR » passe avant « Eden », et « Édition » et « Élixir » tombent après
 * « Zèbre ». Une collation ICU (`fr-FR-x-icu`) rend le bon ordre, mais elle
 * dépend de la façon dont le serveur a été construit et du `datcollate` de la
 * base : un tri juste en développement et faux en production est précisément ce
 * que le jalon 10 a refusé en écartant l'extension `unaccent`. Prisma ne sait
 * d'ailleurs pas exprimer `COLLATE` dans un `orderBy` — il faudrait passer
 * chaque liste en SQL brut et y perdre la composition des filtres.
 *
 * Reste donc le motif déjà éprouvé : **une colonne miroir écrite par
 * l'application**, dont la règle vit ici, en TypeScript, testable sans base.
 *
 * ### Nulle, et non vide
 *
 * Une fiche sans nom rend `null`, jamais `""`. La chaîne vide **se classe en
 * tête** — c'est le plus petit préfixe de tout — et pousserait les vraies
 * entrées vers le bas. `null` laisse au contraire `ORDER BY … NULLS LAST` faire
 * le travail en SQL, sans tri en mémoire et sans valeur sentinelle écrite en
 * base, qui serait une décision d'affichage rangée dans une colonne.
 */
/**
 * Les lettres que la décomposition Unicode ne défait pas.
 *
 * `fold()` retire les accents **combinants** : « é » se décompose en « e » plus
 * un accent, et l'accent part. Mais « ł », « ø » ou « æ » sont des lettres à
 * part entière, que NFD laisse intactes — et leur point de code est supérieur à
 * celui de « z », si bien qu'un nom qui en porte une se classerait **après tout
 * l'alphabet**. C'est le même défaut que celui des accents, une strate plus bas.
 *
 * La table reste ici, et non dans `fold()` : `fold()` écrit `searchText`, et le
 * modifier changerait la valeur stockée de chaque fiche sans que rien ne la
 * recalcule. Le tri n'a pas ce problème — sa clé est recalculée avec lui.
 */
const LETTERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/ł/g, "l"],
  [/ø/g, "o"],
  [/đ|ð/g, "d"],
  [/þ/g, "th"],
  [/ß/g, "ss"],
  [/æ/g, "ae"],
  [/œ/g, "oe"],
];

export function sortKey(parts: ReadonlyArray<string | null | undefined>): string | null {
  let key = fold(
    parts
      .filter((part): part is string => typeof part === "string" && part.trim() !== "")
      .join(" "),
  );
  for (const [pattern, plain] of LETTERS) key = key.replace(pattern, plain);
  return key === "" ? null : key;
}

/**
 * Le comparateur équivalent, pour les listes triées **en mémoire**.
 *
 * Les agrégats — le portefeuille de `/clients`, les colonnes dérivées — ne sont
 * pas des tables : ils se trient après lecture. Ils doivent trier exactement
 * comme SQL, sinon deux écrans classeraient les mêmes noms différemment.
 *
 * `localeCompare` est délibérément écarté : il dépend de la locale du processus
 * — celle du conteneur Railway, pas celle de l'utilisateur — et ferait varier
 * l'ordre selon l'environnement, ce qu'on vient d'écarter côté serveur.
 * Comparer les clés déjà pliées est déterministe partout.
 */
export function compareKeys(a: string | null, b: string | null): number {
  if (a === b) return 0;
  // L'absence va en fin de liste **dans les deux sens** : elle n'est ni avant
  // « A » ni après « Z », elle n'est rien. C'est la règle des relances sans
  // date du jalon 30, appliquée aux noms.
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

/** Tri alphabétique d'une liste, sur une clé lue par `key`. */
export function byName<T>(items: readonly T[], key: (item: T) => string | null): T[] {
  return [...items].sort((a, b) => compareKeys(key(a), key(b)));
}
