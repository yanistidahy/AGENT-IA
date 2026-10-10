/**
 * **La forme du fichier exporté : deux blocs, et l'écart entre eux est la
 * décision de ce jalon.**
 *
 * L'export de contacts existe depuis le jalon 3 et porte une promesse testée :
 * *un export réimporté repasse sans retouche*. Ses en-têtes sont exactement les
 * alias que l'import sait relire, et un test l'impose (`csv-export.test.ts`).
 *
 * Le jalon 108 demande au même fichier des colonnes d'une autre nature : un
 * statut, un canal, une campagne, « a répondu », « prospect chaud ». Aucune
 * n'est une colonne de saisie — elles sont **dérivées**, et aucune n'a d'alias à
 * l'import. Les mêler aux premières aurait cassé la promesse sans rien dire.
 *
 * D'où deux blocs, dans cet ordre :
 *
 * 1. `IMPORT_HEADERS` — les quinze colonnes de saisie, en-têtes **inchangés**.
 *    Un export réimporté écrit toujours les mêmes champs ;
 * 2. `DERIVED_HEADERS` — ce que le CRM sait et qui ne se ressaisit pas. L'import
 *    les ignore et les compte comme ignorées, ce qui est honnête : elles ne
 *    décrivent pas une valeur qu'on aurait tapée.
 *
 * La garde `contact-export-source` impose la séparation, pour qu'une colonne
 * dérivée ne vienne pas se glisser dans le premier bloc.
 */

/* ------------------------------------------------------- les en-têtes ----- */

/**
 * Les colonnes que l'import sait relire, **dans l'ordre d'avant ce jalon**.
 *
 * Ne pas les renommer : chacune correspond à un alias de `CONTACT_COLUMNS`, et
 * la promesse de réimport tient à cette correspondance.
 */
export const IMPORT_HEADERS = [
  "Prénom",
  "Nom",
  "Fonction",
  "Département",
  "Email",
  "Téléphone",
  "LinkedIn",
  "Cycle de vie",
  "Source",
  "Propriétaire",
  "Société",
  "Site",
  "Dernier contact",
  "Prochaine relance",
  "Notes",
] as const;

/**
 * Ce que le CRM sait, et qui ne se ressaisit pas.
 *
 * **Chaque libellé a été choisi contre la table d'alias de l'import**, et c'est
 * un vrai piège : `statut` et `etape` sont tous deux des alias de `lifecycle`.
 * Une colonne nommée « Statut » ou « Étape » aurait donc été relue comme un
 * cycle de vie, et un réimport aurait écrit « Jamais contacté » dans le champ
 * qui porte « Client ». Les libellés sont donc « Statut de relance » et « Étape
 * de séquence » — le vocabulaire que le produit emploie déjà, et qui ne
 * normalise vers aucun alias.
 */
export const DERIVED_HEADERS = [
  "Instagram",
  "Groupe de fonction",
  "Statut de relance",
  "Dernier canal",
  "Campagne en cours",
  "Étape de séquence",
  "A répondu",
  "Prospect chaud",
  "Moyens de contact disponibles",
  "Lien vers la fiche",
] as const;

export const EXPORT_HEADERS: readonly string[] = [...IMPORT_HEADERS, ...DERIVED_HEADERS];

/* ----------------------------------------------------------- les cases ---- */

/**
 * Une date en JJ/MM/AAAA, le format qu'Excel en locale française lit comme une
 * date.
 *
 * L'export écrivait de l'ISO (`2026-02-11`), qu'Excel français affiche tel quel
 * en texte : on ne peut alors ni trier, ni filtrer par mois, c'est-à-dire
 * exactement ce qu'on vient faire dans un tableur. **Le réimport n'en souffre
 * pas** : l'import accepte les deux formats depuis le jalon 3, et traite le
 * format français explicitement parce que `new Date("11/02/2026")` lit un mois
 * américain et décale la date de neuf mois en silence.
 *
 * Les composantes sont lues en temps **local**, comme partout où le produit
 * affiche un jour : une date rendue en UTC recule d'un jour tous les soirs.
 */
export function formatDayFr(date: Date | null): string {
  if (date === null) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** « oui » / « non » — un seul vocabulaire pour les deux colonnes booléennes. */
export function yesNo(value: boolean): string {
  return value ? "oui" : "non";
}

/**
 * Par quoi cette personne est joignable.
 *
 * C'est la colonne qui décide d'un geste : on n'appelle pas une fiche sans
 * téléphone, et on n'écrit pas à une fiche sans adresse. Les moyens sont listés
 * dans l'ordre où l'on s'en sert en prospection, et une fiche injoignable le dit
 * en toutes lettres plutôt que de rendre une case vide — une case vide se lit
 * comme une donnée manquante, « aucun » se lit comme un fait.
 */
export function contactMeans(contact: {
  readonly email: string;
  readonly phone: string;
  readonly instagram: string;
  readonly linkedin: string;
}): string {
  const means: string[] = [];
  if (contact.email.trim() !== "") means.push("Email");
  if (contact.phone.trim() !== "") means.push("Téléphone");
  if (contact.instagram.trim() !== "") means.push("Instagram");
  if (contact.linkedin.trim() !== "") means.push("LinkedIn");
  return means.length === 0 ? "aucun" : means.join(" · ");
}

/**
 * L'étape d'une séquence, dite comme l'écran la dit : « 2 sur 3 ».
 *
 * `lastStep` est le nombre d'étapes **déjà envoyées**, donc `0` veut dire « rien
 * n'est encore parti » et non « étape zéro ». La case le dit plutôt que
 * d'afficher un nombre qui se lirait de travers.
 */
export function stepLabel(lastStep: number, total: number): string {
  if (total <= 0) return "";
  if (lastStep <= 0) return `pas encore écrit (0 sur ${total})`;
  return `${lastStep} sur ${total}`;
}

/**
 * L'origine que l'utilisateur a réellement dans sa barre d'adresse.
 *
 * **`nextUrl.origin` ne la donne pas, et c'est mesuré** : le serveur standalone
 * se lie à `0.0.0.0`, donc la première version de cette colonne a exporté
 * `http://0.0.0.0:3312/contacts?fiche=…` — un lien que personne ne peut ouvrir.
 * Derrière le proxy de Railway, le même défaut rendrait l'origine interne du
 * conteneur.
 *
 * L'ordre va donc du plus proche du navigateur au plus lointain : les en-têtes
 * que le proxy pose (`x-forwarded-*`), puis l'hôte demandé, puis l'adresse
 * publique réglée, puis l'origine de la requête en dernier recours. Le premier
 * qui répond gagne, et un hôte vide n'est jamais retenu.
 */
export function originFromHeaders(
  headers: {
    readonly forwardedHost: string;
    readonly forwardedProto: string;
    readonly host: string;
  },
  fallbacks: { readonly publicUrl: string; readonly requestOrigin: string },
): string {
  const host = headers.forwardedHost.split(",")[0]?.trim() ?? "";
  const proto = headers.forwardedProto.split(",")[0]?.trim() ?? "";
  if (host !== "") return `${proto === "" ? "https" : proto}://${host}`;

  const plain = headers.host.trim();
  if (plain !== "") return `${proto === "" ? "http" : proto}://${plain}`;

  if (fallbacks.publicUrl.trim() !== "") return fallbacks.publicUrl.trim();
  return fallbacks.requestOrigin;
}

/**
 * Le lien vers la fiche, sur l'origine réellement servie.
 *
 * Celui qui télécharge le fichier est connecté sur cette origine, donc le lien
 * lui ouvre bien la fiche — voir `originFromHeaders` pour la façon dont elle est
 * établie, et pourquoi l'origine de la requête ne suffit pas.
 */
export function recordLink(origin: string, contactId: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/contacts?fiche=${encodeURIComponent(contactId)}`;
}
