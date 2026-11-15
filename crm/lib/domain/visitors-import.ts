import { parseGrid, normalizeHeader } from "./csv";
import { parseVisitors } from "./company-profile";
import { sortKey } from "./sort-key";

/**
 * **Le collage de trafics : rapprocher un tableur de marques déjà en base.**
 *
 * Le besoin est précis et il est petit : quelqu'un a un tableur de 200 lignes
 * « domaine ; visiteurs » sorti d'un outil d'analyse, et veut que le CRM s'en
 * serve. Ce module fait **le rapprochement et rien d'autre** — il ne touche
 * pas la base, il ne crée rien, il rend une décision par ligne.
 *
 * ## Trois refus qui définissent ce que fait cet import
 *
 * 1. **il ne crée jamais de société.** C'est la demande explicite du brief, et
 *    c'est aussi la seule façon qu'un import de trafic reste un import de
 *    trafic : un tableur d'analyse d'audience contient des domaines qu'on ne
 *    prospecte pas, et les laisser entrer peuplerait le CRM de maisons que
 *    personne n'a choisies. Une ligne sans correspondance est **nommée**, pas
 *    avalée ;
 * 2. **il ne devine pas un nombre.** « beaucoup » et « ~8k » (avec le tilde)
 *    sont refusés ligne par ligne, avec leur raison, plutôt que rangés à zéro —
 *    la règle du jalon 20, et le piège que `parseVisitors` existe pour fermer ;
 * 3. **il n'écrase pas en silence sans le dire.** Une ligne dont la valeur est
 *    déjà celle de la fiche est comptée « inchangée » et non « mise à jour » :
 *    « 120 lignes mises à jour » sur un second passage ferait douter du premier.
 *
 * ## Le rapprochement, et pourquoi deux clés
 *
 * Un tableur d'audience parle **domaines** ; un tableur de prospection parle
 * **noms**. On accepte les deux dans la même colonne, et on tranche par ligne :
 * ce qui ressemble à un domaine (un point, pas d'espace) est rapproché du
 * domaine de la société, le reste de son nom. Les deux clés sont **pliées** —
 * casse et accents — par `sortKey`, la fonction qui écrit déjà `Company.nameKey`
 * en base : utiliser deux plis différents ferait que « Zénith » se retrouverait
 * à l'import et pas au tri.
 *
 * Une clé qui désigne **plusieurs** sociétés n'est pas appliquée : elle est
 * signalée comme ambiguë. Écrire sur la première des deux serait un tirage au
 * sort silencieux sur la donnée de quelqu'un.
 */

/* ------------------------------------------------------------ les clés ---- */

/**
 * Le domaine, réduit à ce qui l'identifie : minuscules, sans schéma, sans
 * `www.`, sans chemin ni port.
 *
 * `example.com`, `https://www.Example.com/`, `www.example.com/tarifs` sont la
 * même maison, et une ligne de tableur peut porter n'importe laquelle de ces
 * trois formes.
 */
export function domainKey(raw: string): string {
  const text = raw.trim().toLowerCase();
  if (text === "") return "";
  const withoutScheme = text.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  const host = withoutScheme.split(/[/?#]/)[0] ?? "";
  return host.replace(/^www\./, "").replace(/:\d+$/, "");
}

/** Le nom, plié comme `Company.nameKey` l'est en base. */
export function companyKeyOf(raw: string): string {
  return sortKey([raw]) ?? "";
}

/**
 * **Cette cellule est-elle un domaine ?**
 *
 * Un point, pas d'espace, et une extension d'au moins deux lettres. « Zenith
 * Labs » n'en est pas un ; « zenithlabs.fr » en est un. Le test est volontaire-
 * ment étroit : une maison nommée « 3.0 Studio » ne doit pas être cherchée
 * parmi les domaines, où elle ne serait jamais trouvée.
 */
export function looksLikeDomain(raw: string): boolean {
  const text = raw.trim();
  if (text === "" || /\s/.test(text)) return false;
  return /^(?:[a-z][a-z0-9+.-]*:\/\/)?[^\s/?#]+\.[a-z]{2,}(?:[/?#].*)?$/i.test(text);
}

/* --------------------------------------------------------- les colonnes --- */

/**
 * Les en-têtes reconnus, pliés par `normalizeHeader` — celui de l'import de
 * contacts, pour qu'« Société » et « societe » se rejoignent ici comme là-bas.
 */
const KEY_HEADERS = [
  "societe",
  "société",
  "entreprise",
  "marque",
  "nom",
  "nomdelasociete",
  "domaine",
  "site",
  "siteweb",
  "url",
  "domain",
  "company",
  "website",
];

const VALUE_HEADERS = [
  "visiteurs",
  "visiteursmois",
  "visiteursmensuels",
  "visiteursparmois",
  "visites",
  "trafic",
  "traficmensuel",
  "audience",
  "monthlyvisitors",
  "visits",
  "traffic",
  "sessions",
];

export interface ImportColumns {
  readonly key: number;
  readonly value: number;
  /** Vrai quand la première ligne a été reconnue comme un en-tête. */
  readonly hasHeader: boolean;
}

/**
 * Quelles colonnes lire, d'après l'en-tête — ou les deux premières à défaut.
 *
 * **Sans en-tête, on prend la colonne 0 et la colonne 1**, et c'est assumé : un
 * collage de deux colonnes sans titre est le geste le plus courant (copier deux
 * colonnes d'un tableur), et refuser de le lire obligerait à ajouter une ligne
 * de titre pour rien. Avec plus de deux colonnes et aucun en-tête reconnu, on
 * refuse en revanche : deviner laquelle porte le trafic serait un tirage au
 * sort sur la donnée.
 */
export function readColumns(rows: readonly (readonly string[])[]): ImportColumns | null {
  const header = rows[0];
  if (header === undefined) return null;

  const folded = header.map((cell) => normalizeHeader(cell));
  const key = folded.findIndex((cell) => KEY_HEADERS.includes(cell));
  const value = folded.findIndex((cell) => VALUE_HEADERS.includes(cell));
  if (key !== -1 && value !== -1 && key !== value) return { key, value, hasHeader: true };

  if (header.length === 2) return { key: 0, value: 1, hasHeader: false };
  return null;
}

/* ------------------------------------------------------- une décision ----- */

export const IMPORT_OUTCOMES = [
  "updated",
  "unchanged",
  "unmatched",
  "ambiguous",
  "unreadable",
] as const;
export type ImportOutcome = (typeof IMPORT_OUTCOMES)[number];

export interface ImportLine {
  /** Le numéro de ligne **dans le collage**, en comptant l'en-tête. */
  readonly line: number;
  readonly raw: string;
  readonly rawValue: string;
  readonly outcome: ImportOutcome;
  /** La société rapprochée, quand il y en a exactement une. */
  readonly companyId: string | null;
  readonly companyName: string;
  /** La valeur à écrire, quand la ligne est lisible. */
  readonly visitors: number | null;
  /** Ce que la fiche portait déjà — pour que « inchangée » se vérifie. */
  readonly before: number | null;
  /** La raison, quand la ligne n'aboutit pas. */
  readonly reason: string;
}

export interface ImportPlan {
  readonly lines: readonly ImportLine[];
  readonly updated: number;
  readonly unchanged: number;
  readonly unmatched: number;
  readonly ambiguous: number;
  readonly unreadable: number;
  /** Le nombre de lignes de données lues, en-tête exclu. */
  readonly read: number;
}

/** Ce que le plan a besoin de savoir d'une société, et rien de plus. */
export interface ImportCompany {
  readonly id: string;
  readonly name: string;
  readonly domain: string;
  readonly monthlyVisitors: number | null;
}

/**
 * **Le plan d'import : une décision par ligne, aucune écriture.**
 *
 * Rendre un plan plutôt qu'écrire directement est ce qui permet d'afficher le
 * rapport **avant** de valider — et c'est le même motif que les corrections de
 * `/reglages` depuis le jalon 12 : simuler, lire, appliquer.
 */
export function planVisitorsImport(
  text: string,
  companies: readonly ImportCompany[],
): ImportPlan {
  const rows = parseGrid(text);
  const columns = readColumns(rows);
  if (columns === null) {
    return { lines: [], updated: 0, unchanged: 0, unmatched: 0, ambiguous: 0, unreadable: 0, read: 0 };
  }

  /*
    Deux index, construits une fois : par domaine plié et par nom plié. Une clé
    qui désigne plusieurs sociétés porte `null` — c'est la marque de l'ambiguïté,
    et elle doit survivre jusqu'à la décision plutôt que d'être tranchée ici.
  */
  const byDomain = new Map<string, ImportCompany | null>();
  const byName = new Map<string, ImportCompany | null>();
  const add = (index: Map<string, ImportCompany | null>, key: string, company: ImportCompany) => {
    if (key === "") return;
    index.set(key, index.has(key) ? null : company);
  };
  for (const company of companies) {
    add(byDomain, domainKey(company.domain), company);
    add(byName, companyKeyOf(company.name), company);
  }

  const lines: ImportLine[] = [];
  const start = columns.hasHeader ? 1 : 0;
  for (let index = start; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const raw = (row[columns.key] ?? "").trim();
    const rawValue = (row[columns.value] ?? "").trim();
    if (raw === "" && rawValue === "") continue;

    const line = index + 1;
    const base = { line, raw, rawValue, companyId: null, companyName: "", visitors: null, before: null };

    /*
      **La valeur est lue avant le rapprochement.** Une ligne illisible est
      illisible même si sa société existe, et le dire tout de suite évite un
      rapport qui annonce « rapprochée » une ligne qui n'écrira rien.
    */
    const parsed = parseVisitors(rawValue);
    if (!parsed.ok) {
      lines.push({ ...base, outcome: "unreadable", reason: parsed.message });
      continue;
    }
    if (parsed.value === null) {
      lines.push({
        ...base,
        outcome: "unreadable",
        reason: "Aucun nombre de visiteurs sur cette ligne.",
      });
      continue;
    }

    const found = looksLikeDomain(raw) ? byDomain.get(domainKey(raw)) : byName.get(companyKeyOf(raw));
    if (found === undefined) {
      lines.push({
        ...base,
        visitors: parsed.value,
        outcome: "unmatched",
        reason: looksLikeDomain(raw)
          ? "Aucune société ne porte ce domaine."
          : "Aucune société ne porte ce nom.",
      });
      continue;
    }
    if (found === null) {
      lines.push({
        ...base,
        visitors: parsed.value,
        outcome: "ambiguous",
        reason: "Plusieurs sociétés correspondent : à trancher sur leur fiche.",
      });
      continue;
    }

    const unchanged = found.monthlyVisitors === parsed.value;
    lines.push({
      ...base,
      outcome: unchanged ? "unchanged" : "updated",
      companyId: found.id,
      companyName: found.name,
      visitors: parsed.value,
      before: found.monthlyVisitors,
      reason: "",
    });
  }

  const count = (outcome: ImportOutcome) => lines.filter((line) => line.outcome === outcome).length;
  return {
    lines,
    updated: count("updated"),
    unchanged: count("unchanged"),
    unmatched: count("unmatched"),
    ambiguous: count("ambiguous"),
    unreadable: count("unreadable"),
    read: lines.length,
  };
}
