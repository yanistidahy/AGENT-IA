/**
 * **Les deux champs de profil qu'une marque porte, et qui peut les écrire.**
 *
 * La niche et le trafic mensuel décident à eux deux de presque tout l'onglet
 * « Segments » : la niche est l'axe du tableau du bas, le trafic range la marque
 * dans une tranche de taille (`lib/domain/size-buckets.ts`). Les deux peuvent
 * arriver par deux chemins — tapés à la main dans le CRM, ou lus dans les
 * variables personnalisées d'un lead lemlist —, et c'est ce doublon de sources
 * qui rend ce module nécessaire.
 *
 * Trois règles, et chacune répond à une façon précise de perdre une donnée :
 *
 * 1. **une valeur tapée à la main n'est jamais écrasée par la synchronisation.**
 *    Quelqu'un qui corrige un trafic dans le CRM corrige précisément ce que
 *    lemlist dit de faux ; laisser le relevé de quinze minutes le remettre
 *    ferait disparaître la correction sans trace, et on recommencerait ;
 * 2. **on enregistre qui a posé chaque valeur**, champ par champ. Sans cela la
 *    règle 1 serait inapplicable : on ne saurait pas distinguer un 8 000 saisi
 *    d'un 8 000 importé, et il faudrait soit tout écraser, soit ne plus rien
 *    importer ;
 * 3. **une valeur illisible n'est pas une valeur.** « à voir », « ?», « gros
 *    site » rendent `null` et non zéro — zéro affirmerait un site sans visite,
 *    et c'est la règle du jalon 20 appliquée à la saisie.
 */

/* ------------------------------------------------- qui a posé la valeur ---- */

/**
 * L'origine d'une valeur de profil.
 *
 * `""` veut dire « on ne sait pas » : c'est l'état des lignes écrites avant ce
 * jalon. La migration le remplace par `crm` partout où un trafic est déjà
 * renseigné, parce que le CRM était jusqu'ici le **seul** chemin d'écriture —
 * donc ces valeurs ont bien été tapées à la main, et les traiter comme
 * inconnues les aurait exposées au premier relevé.
 */
export const VALUE_SOURCES = ["crm", "lemlist", ""] as const;
export type ValueSource = (typeof VALUE_SOURCES)[number];

export const VALUE_SOURCE_LABELS: Readonly<Record<string, string>> = {
  crm: "saisi dans le CRM",
  lemlist: "importé de lemlist",
  "": "origine inconnue",
};

export function valueSourceLabel(source: string): string {
  return VALUE_SOURCE_LABELS[source] ?? source;
}

/**
 * **La synchronisation peut-elle écrire ce champ ?**
 *
 * Oui si le champ est vide, quelle que soit son origine : il n'y a rien à
 * perdre. Oui s'il porte déjà une valeur que la synchronisation a elle-même
 * posée : lemlist est alors la source de vérité de ce champ, et refuser la mise
 * à jour figerait un trafic de l'an dernier.
 *
 * Non dès qu'une valeur est présente et vient d'ailleurs — du CRM, ou d'une
 * origine inconnue. Le cas « inconnu » tranche volontairement en faveur de la
 * conservation : devant une valeur dont on ignore la provenance, l'écraser est
 * le choix irréversible, la garder ne coûte qu'un import de moins.
 */
export function syncMayWrite(current: { readonly filled: boolean; readonly source: string }): boolean {
  if (!current.filled) return true;
  return current.source === "lemlist";
}

/* ------------------------------------------------------------ la niche ----- */

/** Le plus long qu'on accepte : au-delà c'est une phrase, pas une niche. */
export const NICHE_MAX = 60;

/**
 * La niche telle qu'on la stocke : **espaces rognés, casse d'origine gardée**.
 *
 * On ne met pas en minuscules à l'écriture. « Bijoux » tapé par quelqu'un doit
 * se relire « Bijoux » : normaliser l'affichage pour simplifier le
 * regroupement reviendrait à abîmer la donnée pour arranger le code. Le
 * regroupement passe par `nicheKey`, qui est une clé, pas un libellé.
 *
 * Les espaces internes multiples sont réduits à un seul, parce qu'un copier
 * -coller depuis un tableur en apporte, et que « Soins  visage » et « Soins
 * visage » ne doivent pas faire deux niches.
 */
export function cleanNiche(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, NICHE_MAX);
}

/**
 * **La clé de regroupement : insensible à la casse et aux accents.**
 *
 * « Bijoux », « bijoux » et « BIJOUX » sont la même niche, et « Beauté » est la
 * même que « beaute » — c'est le pli que `lib/domain/text.ts` applique déjà à la
 * recherche, et appliquer deux plis différents dans le même produit ferait
 * qu'une niche trouvée par la recherche ne se retrouverait pas dans le tableau.
 */
export function nicheKey(raw: string): string {
  return cleanNiche(raw)
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** La niche vide, écrite une fois : le tableau en fait une ligne nommée. */
export const NO_NICHE = "non-renseignee";
export const NO_NICHE_LABEL = "Niche non renseignée";

/**
 * Les niches déjà en usage, pour les suggestions du champ.
 *
 * Regroupées par clé, et **le libellé affiché est la variante la plus
 * fréquente** — à égalité, la première rencontrée. Proposer « bijoux » à
 * quelqu'un qui a toujours écrit « Bijoux » le pousserait à créer la variante
 * qu'on cherche justement à éviter.
 *
 * Triées par fréquence décroissante puis par libellé : une liste alphabétique
 * met en tête ce qui commence par « A », une liste par fréquence met en tête ce
 * qu'on va effectivement choisir.
 */
export interface NicheSuggestion {
  readonly key: string;
  readonly label: string;
  readonly count: number;
}

export function nicheSuggestions(values: readonly string[]): NicheSuggestion[] {
  const groups = new Map<string, { readonly key: string; variants: Map<string, number>; count: number }>();
  for (const raw of values) {
    const label = cleanNiche(raw);
    if (label === "") continue;
    const key = nicheKey(label);
    const group = groups.get(key) ?? { key, variants: new Map<string, number>(), count: 0 };
    group.variants.set(label, (group.variants.get(label) ?? 0) + 1);
    group.count += 1;
    groups.set(key, group);
  }

  const out: NicheSuggestion[] = [];
  for (const group of groups.values()) {
    let best = "";
    let bestCount = 0;
    for (const [label, count] of group.variants) {
      if (count > bestCount) {
        best = label;
        bestCount = count;
      }
    }
    out.push({ key: group.key, label: best, count: group.count });
  }
  out.sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label, "fr"));
  return out;
}

/* ---------------------------------------------------------- le trafic ------ */

/** Au-delà, c'est une faute de frappe : aucune boutique ne fait un milliard. */
export const VISITORS_MAX = 1_000_000_000;

/**
 * **Le trafic mensuel, lu d'une valeur tapée par un humain.**
 *
 * Les variables personnalisées de lemlist sont du texte libre, remplies à la
 * main dans une colonne de tableur. Les quatre formes du brief s'y trouvent
 * toutes : `8000`, `8 000`, `8k`, `8K`. Quatre autres s'y trouvent aussi dès
 * qu'on regarde de vraies lignes, et les refuser perdrait de la donnée réelle :
 * l'espace insécable que Google Sheets produit, le point ou la virgule de
 * milliers, le `k` décimal (`8,5k`), et le suffixe `M`.
 *
 * **Le point et la virgule sont ambigus, et l'ambiguïté est tranchée par le
 * nombre de décimales** : trois chiffres derrière le séparateur et aucun
 * suffixe, c'est un séparateur de milliers (`8.000` = 8 000, la convention
 * française) ; un ou deux chiffres, c'est une décimale (`8,5k` = 8 500).
 * Deux séparateurs dans la valeur (`1.234.567`) sont donc tous des milliers.
 *
 * Tout le reste rend `null`. **Jamais zéro** : « ?», « à voir », « beaucoup »
 * sont des absences de mesure, et les compter comme un site sans visite
 * rangerait la marque dans « Moins de 2 000 » sur la foi d'un point
 * d'interrogation.
 */
export function readVisitorCount(raw: string): number | null {
  // Espaces ordinaires, insécables (U+00A0) et insécables fines (U+202F), plus
  // l'apostrophe des milliers suisse : tous des séparateurs, aucun du sens.
  const text = raw.replace(/[\s  '’]/g, "").trim();
  if (text === "") return null;

  const match = /^([0-9][0-9.,]*)([kKmM])?$/.exec(text);
  if (match === null) return null;
  const digits = match[1] ?? "";
  const suffix = (match[2] ?? "").toLowerCase();

  // Les séparateurs de milliers : trois chiffres derrière chacun, et pas de
  // suffixe d'échelle — « 8.000k » n'est pas une écriture qu'on invente.
  const thousands = /^[0-9]{1,3}([.,][0-9]{3})+$/.test(digits);
  let value: number;
  if (thousands) {
    if (suffix !== "") return null;
    value = Number.parseInt(digits.replace(/[.,]/g, ""), 10);
  } else {
    // Une seule décimale admise, un ou deux chiffres : au-delà on ne sait plus
    // ce que la personne a voulu dire, et deviner serait pire que refuser.
    if (!/^[0-9]+([.,][0-9]{1,2})?$/.test(digits)) return null;
    value = Number.parseFloat(digits.replace(",", "."));
  }

  if (!Number.isFinite(value)) return null;
  const scaled = suffix === "k" ? value * 1_000 : suffix === "m" ? value * 1_000_000 : value;
  const rounded = Math.round(scaled);
  if (rounded < 0 || rounded > VISITORS_MAX) return null;
  return rounded;
}

/* ------------------------------------- les noms des variables lemlist ------ */

/**
 * **Les noms cherchés dans les variables du lead, comparés sans casse.**
 *
 * Le brief nomme « niche » et « visiteurs ». Une variable lemlist est nommée à
 * la main : `Niche`, `NICHE`, `niche` existent tous, et l'accent de
 * « visiteurs » comme le pluriel varient aussi. On compare donc des clés
 * pliées, et on accepte les quelques synonymes qu'un tableur francophone
 * produit — jamais une recherche par sous-chaîne, qui ferait passer
 * « visiteurs_annuels » pour le trafic mensuel.
 */
export const NICHE_VARIABLES: readonly string[] = ["niche", "nichemarche", "secteur", "categorie"];
export const VISITORS_VARIABLES: readonly string[] = [
  "visiteurs",
  "visiteursmensuels",
  "visites",
  "traficmensuel",
  "trafic",
  "monthlyvisitors",
  "visitors",
];

/** Le pli d'un nom de variable : minuscules, sans accents ni séparateurs. */
export function variableKey(name: string): string {
  return name
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * La première valeur non vide parmi les variables acceptées.
 *
 * L'ordre de `wanted` fait foi : `niche` l'emporte sur `secteur` quand les deux
 * sont remplies, parce que le brief nomme la première et que tolérer la seconde
 * ne doit pas lui donner le dernier mot.
 */
export function pickVariable(
  variables: Readonly<Record<string, string>>,
  wanted: readonly string[],
): string {
  const folded = new Map<string, string>();
  for (const [name, value] of Object.entries(variables)) {
    const key = variableKey(name);
    if (key === "" || folded.has(key)) continue;
    folded.set(key, value);
  }
  for (const name of wanted) {
    const value = folded.get(name);
    if (value !== undefined && value.trim() !== "") return value;
  }
  return "";
}
