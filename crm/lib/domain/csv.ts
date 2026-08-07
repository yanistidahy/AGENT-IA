/**
 * Lecture de tableurs collés.
 *
 * Le cas d'usage réel est un copier-coller depuis Google Sheets ou Excel, pas un
 * fichier `.csv` propre : le séparateur varie (tabulation au collage, point-virgule
 * à l'export français, virgule à l'export anglo-saxon) et l'en-tête est écrit à la
 * main, en français, sans casse ni accents fiables.
 *
 * Ce module est pur : ni Prisma, ni React. Il transforme du texte en lignes de
 * cellules et devine la correspondance des colonnes ; la création des
 * enregistrements se fait ailleurs, dans lib/api/contact-import.ts.
 */

export const DELIMITERS = ["\t", ";", ","] as const;
export type Delimiter = (typeof DELIMITERS)[number];

/**
 * Séparateur le plus probable : celui qui découpe la première ligne en le plus de
 * cellules. Départage par l'ordre de `DELIMITERS`, tabulation d'abord — c'est ce
 * que produit un collage depuis un tableur, et une cellule peut légitimement
 * contenir une virgule.
 */
export function detectDelimiter(text: string): Delimiter {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  let best: Delimiter = DELIMITERS[0];
  let bestCount = 0;

  for (const candidate of DELIMITERS) {
    const count = splitLine(firstLine, candidate).length;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

/** Découpe une ligne en respectant les guillemets doubles (`""` = guillemet littéral). */
function splitLine(line: string, delimiter: Delimiter): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index] ?? "";
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

/**
 * Texte collé → grille de cellules.
 *
 * Le découpage se fait en une seule passe sur tout le texte, et non ligne par
 * ligne : une cellule entre guillemets peut contenir un saut de ligne, ce que
 * produit n'importe quelle note multiligne exportée par ce CRM. Découper d'abord
 * sur `\n` casserait le retour d'un export dans l'import.
 *
 * Les lignes entièrement vides sont écartées : un collage se termine presque
 * toujours par un saut de ligne, et une ligne vide n'est pas un contact.
 */
export function parseGrid(text: string, delimiter: Delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let quoted = false;

  const endCell = () => {
    row.push(current.trim());
    current = "";
  };
  const endRow = () => {
    endCell();
    if (row.some((value) => value !== "")) rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";

    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      endCell();
    } else if ((char === "\n" || char === "\r") && !quoted) {
      // `\r\n` ne doit fermer la ligne qu'une fois.
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      endRow();
    } else {
      current += char;
    }
  }
  endRow();

  return rows;
}

/** Champs qu'une colonne peut alimenter. `company` est le *nom* de la société. */
export const CONTACT_COLUMNS = [
  "firstName",
  "lastName",
  "title",
  "dep",
  "email",
  "phone",
  "linkedin",
  "lifecycle",
  "source",
  "owner",
  "notes",
  "company",
  "lastContact",
  "nextReminder",
] as const;
export type ContactColumn = (typeof CONTACT_COLUMNS)[number];

/**
 * Alias acceptés par en-tête, comparés après normalisation (minuscules, accents
 * retirés, ponctuation retirée). La première correspondance gagne.
 */
const ALIASES: Record<ContactColumn, readonly string[]> = {
  firstName: ["prenom", "firstname", "first", "givenname"],
  lastName: ["nom", "nomdefamille", "lastname", "last", "surname", "familyname"],
  title: ["fonction", "poste", "titre", "title", "jobtitle", "intitule"],
  dep: ["departement", "service", "dep", "department", "equipe"],
  email: ["email", "mail", "courriel", "adresseemail", "adressemail", "emailpro"],
  phone: ["telephone", "tel", "phone", "mobile", "portable", "numero"],
  linkedin: ["linkedin", "profillinkedin", "urllinkedin", "lienlinkedin"],
  lifecycle: ["cycledevie", "lifecycle", "statut", "stade", "etape", "type"],
  source: ["source", "origine", "canal", "provenance"],
  owner: ["proprietaire", "owner", "responsable", "commercial", "assignea"],
  notes: ["notes", "note", "commentaire", "commentaires", "remarques"],
  company: ["societe", "entreprise", "company", "organisation", "compte", "client"],
  lastContact: ["derniercontact", "dernierecho", "lastcontact", "dernierechange"],
  nextReminder: ["prochainerelance", "relance", "nextreminder", "prochainerelanceprevue"],
};

/**
 * Date d'une cellule de tableur.
 *
 * Deux formats sont acceptés : ISO (`2026-03-01`, ce que produit l'export) et le
 * format français `JJ/MM/AAAA`. Le second est traité explicitement parce que
 * `new Date("11/02/2026")` lit un mois américain et renvoie le 2 novembre —
 * silencieusement, avec neuf mois d'écart.
 */
export function parseCellDate(value: string): Date | null | "invalid" {
  const trimmed = value.trim();
  if (trimmed === "") return null;

  const french = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(trimmed);
  if (french !== null) {
    const [, day, month, year] = french;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? "invalid" : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? "invalid" : parsed;
}

/** Minuscules, sans accents ni ponctuation : « Prénom / Nom » et « prenom_nom » se rejoignent. */
export function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export interface HeaderMapping {
  /** Index de colonne pour chaque champ reconnu. */
  readonly columns: Partial<Record<ContactColumn, number>>;
  /** En-têtes qu'aucun alias ne couvre — signalés à l'utilisateur, jamais devinés. */
  readonly ignored: readonly string[];
}

/**
 * En-tête → correspondance des colonnes.
 *
 * Une colonne déjà attribuée n'est pas réattribuée : si un tableau contient
 * « Nom » et « Nom de famille », c'est le premier qui l'emporte, et le second est
 * signalé comme ignoré plutôt que d'écraser silencieusement le premier.
 */
export function mapHeaders(header: readonly string[]): HeaderMapping {
  const columns: Partial<Record<ContactColumn, number>> = {};
  const ignored: string[] = [];

  header.forEach((raw, index) => {
    const normalized = normalizeHeader(raw);
    if (normalized === "") return;

    const field = CONTACT_COLUMNS.find(
      (candidate) => columns[candidate] === undefined && ALIASES[candidate].includes(normalized),
    );

    if (field === undefined) ignored.push(raw);
    else columns[field] = index;
  });

  return { columns, ignored };
}

/**
 * Une ligne d'en-tête est reconnue comme telle si au moins deux de ses colonnes
 * correspondent à un alias. En dessous, on considère que le collage commence
 * directement par des données — un tableau sans en-tête n'est pas importable, et
 * il vaut mieux le dire que d'avaler la première personne de la liste.
 */
export function looksLikeHeader(row: readonly string[]): boolean {
  return Object.keys(mapHeaders(row).columns).length >= 2;
}

/**
 * Grille → texte CSV, séparateur point-virgule.
 *
 * C'est le séparateur qu'Excel en locale française attend : un export virgule
 * s'ouvre en une seule colonne, et l'utilisateur conclut que l'export est cassé.
 * Une cellule est mise entre guillemets dès qu'elle contient un séparateur, un
 * guillemet ou un saut de ligne.
 */
export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(escapeCell).join(";")).join("\r\n");
}

function escapeCell(value: string): string {
  if (!/[";\r\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/** Valeur d'une colonne pour une ligne, chaîne vide si la colonne est absente. */
export function cell(
  row: readonly string[],
  mapping: HeaderMapping,
  field: ContactColumn,
): string {
  const index = mapping.columns[field];
  if (index === undefined) return "";
  return row[index] ?? "";
}
