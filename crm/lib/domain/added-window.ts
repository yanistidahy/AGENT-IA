/**
 * **Depuis quand une fiche est-elle dans le vivier ?**
 *
 * La date existe depuis toujours (`Contact.createdAt`, écrite par la base), et
 * la fiche l'affiche en ancienneté depuis le jalon 22. Ce qui manquait, c'est de
 * pouvoir s'en servir pour trancher une liste.
 *
 * ## Quatre préréglages, parce que c'est ce qu'on ouvre le matin
 *
 * « Aujourd'hui », « cette semaine », « ce mois » et « les 30 derniers jours »
 * répondent à la question qu'on se pose vraiment : est-ce que j'alimente le
 * vivier, ou est-ce que je ne fais que retravailler ce qui s'y trouve déjà ?
 * Une plage libre couvre le reste, sans encombrer la barre.
 *
 * ## Semaine et mois **calendaires**, trente jours **glissants**
 *
 * La distinction n'est pas cosmétique. « Cette semaine » veut dire depuis lundi,
 * pas depuis mardi dernier : c'est ainsi qu'on juge sa semaine de travail. « Les
 * 30 derniers jours » veut dire glissant, parce que c'est une mesure de rythme
 * et non un bilan. Confondre les deux ferait un lundi matin où « cette semaine »
 * renvoie le travail de la semaine passée.
 *
 * ## L'horloge est injectée
 *
 * `now` est un paramètre, jamais `new Date()` pris à l'intérieur : sans cela les
 * tests dépendraient du jour où on les lance, et « cette semaine » serait vrai
 * six jours sur sept.
 */

export const ADDED_PRESETS = ["aujourdhui", "semaine", "mois", "30j"] as const;
export type AddedPreset = (typeof ADDED_PRESETS)[number];

export const ADDED_LABELS: Record<AddedPreset, string> = {
  aujourdhui: "Ajoutés aujourd'hui",
  semaine: "Ajoutés cette semaine",
  mois: "Ajoutés ce mois",
  "30j": "Ajoutés sur 30 jours",
};

/** Le libellé court, pour la puce une fois le filtre actif. */
export const ADDED_SHORT: Record<AddedPreset, string> = {
  aujourdhui: "aujourd'hui",
  semaine: "cette semaine",
  mois: "ce mois",
  "30j": "30 jours",
};

export interface AddedWindow {
  /** Borne basse incluse. */
  readonly from: Date;
  /** Borne haute **exclue** : voir `endOfDay`. */
  readonly to: Date;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Le lendemain à minuit, **borne exclue**.
 *
 * Prendre 23:59:59 laisserait passer entre les mailles une fiche créée à
 * 23:59:59,4 : le jour a des millisecondes, et une borne inclusive posée à la
 * seconde en perd mille. La borne exclue au lendemain n'a pas ce trou.
 */
function endOfDay(date: Date): Date {
  const copy = startOfDay(date);
  copy.setDate(copy.getDate() + 1);
  return copy;
}

/** Lundi de la semaine de `now`, à minuit. Semaine française : lundi commence. */
function startOfWeek(now: Date): Date {
  const copy = startOfDay(now);
  // `getDay()` rend 0 pour dimanche : sans ce décalage, le dimanche
  // appartiendrait à la semaine qui commence, et non à celle qui s'achève.
  const shift = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - shift);
  return copy;
}

export function presetWindow(preset: AddedPreset, now: Date): AddedWindow {
  switch (preset) {
    case "aujourdhui":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "semaine":
      return { from: startOfWeek(now), to: endOfDay(now) };
    case "mois": {
      const from = startOfDay(now);
      from.setDate(1);
      return { from, to: endOfDay(now) };
    }
    case "30j": {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 29);
      // Vingt-neuf, pas trente : aujourd'hui compte dans les trente jours.
      return { from, to: endOfDay(now) };
    }
  }
}

/** Une date `AAAA-MM-JJ` venue de l'URL, ou `null` si elle ne décrit rien. */
export function parseDay(raw: string | undefined): Date | null {
  if (raw === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const parsed = new Date(`${raw}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * La fenêtre décrite par l'URL, préréglage ou plage libre.
 *
 * Une plage dont seule une borne est donnée reste valide : « depuis le 1er
 * mars » et « jusqu'au 31 mars » sont deux questions légitimes, et refuser la
 * moitié d'une plage obligerait à saisir une borne qu'on n'a pas en tête. Deux
 * bornes inversées sont remises dans l'ordre plutôt que refusées : c'est une
 * faute de saisie, pas une intention.
 */
export function resolveWindow(
  input: { readonly preset?: string; readonly from?: string; readonly to?: string },
  now: Date,
): AddedWindow | null {
  const preset = ADDED_PRESETS.find((entry) => entry === input.preset);
  if (preset !== undefined) return presetWindow(preset, now);

  const from = parseDay(input.from);
  const to = parseDay(input.to);
  if (from === null && to === null) return null;

  const low = from ?? new Date(0);
  const high = to === null ? endOfDay(now) : endOfDay(to);
  return low <= high ? { from: low, to: high } : { from: high, to: low };
}

/** Ce que la puce affiche quand une plage libre est active. */
export function describeWindow(from: string | undefined, to: string | undefined): string {
  const short = (raw: string) => raw.split("-").reverse().slice(0, 2).join("/");
  if (from !== undefined && to !== undefined) return `du ${short(from)} au ${short(to)}`;
  if (from !== undefined) return `depuis le ${short(from)}`;
  if (to !== undefined) return `jusqu'au ${short(to)}`;
  return "période";
}
