import "server-only";
import { MISSING_KEY_MESSAGE } from "../domain/lemlist";

/**
 * **Le seul endroit du code qui lit `LEMLIST_API_KEY`.**
 *
 * `import "server-only"` en tête : le build Next échoue si un composant client
 * importe cette chaîne. C'est la même garde que `lib/agents/runtime/client.ts`
 * pour la clé Anthropic (jalon 2), et pour la même raison — une clé qui part
 * dans un paquet JavaScript est publiée, pas fuitée.
 *
 * Trois règles tiennent ce module, et elles sont vérifiables :
 *
 * 1. **la clé n'est jamais journalisée ni renvoyée.** Elle entre dans un
 *    en-tête `Authorization` et nulle part ailleurs : aucun `console.log` de ce
 *    module ne reçoit l'URL complète ni les en-têtes, et `describeFailure`
 *    reconstruit un message **sans** le corps de la requête. Un test parcourt
 *    le fichier et échoue si une interpolation de la clé apparaît hors de
 *    l'en-tête ;
 * 2. **une clé refusée se dit, sans se citer.** Un 401 rend « clé refusée par
 *    lemlist » et rien de plus. Citer le message de l'API — qui répète parfois
 *    le début du jeton — ressemblerait à une fuite ; c'est l'écart déjà fixé au
 *    jalon 16 pour Anthropic ;
 * 3. **les appels sont sérialisés.** Voir le paragraphe suivant.
 *
 * ## Les limites d'appel, et comment on les respecte
 *
 * La documentation est explicite : **20 requêtes par 2 secondes**, sur *toutes*
 * les routes, **par clé d'API**. Les réponses portent `Retry-After`,
 * `X-RateLimit-Limit`, `X-RateLimit-Remaining` et `X-RateLimit-Reset`, et un
 * dépassement répond `429`.
 *
 * Ce module ne code donc **aucun nombre magique** de son côté ; il applique
 * trois choses :
 *
 * - **une file d'un seul fil.** Aucune requête lemlist n'est émise en parallèle
 *   d'une autre : `queue` chaîne les appels. Un relevé qui lancerait dix pages
 *   en `Promise.all` consommerait la moitié du budget en une rafale, et le ferait
 *   pour une clé que l'application **partage** avec le reste de l'outillage de
 *   l'utilisateur ;
 * - **un espacement calculé sur le plafond annoncé**, pas devin : `20 / 2 s`
 *   vaut une requête toutes les 100 ms, et on prend une marge de sécurité à
 *   `SPACING_MS` pour laisser de la place à un autre client de la même clé ;
 * - **`Retry-After` est honoré à la lettre** sur un 429, et à défaut d'en-tête
 *   lisible on retombe sur un recul exponentiel borné à quatre tentatives. On ne
 *   lit pas `X-RateLimit-Reset` comme une date : la documentation prévient
 *   elle-même qu'il est au format humain (« Tue Feb 16 2021 09:02:42
 *   GMT+0100 (…) »), que `Date.parse` interprète selon l'implémentation. Le
 *   nombre de secondes de `Retry-After` est la seule valeur dont le format est
 *   sûr.
 */

/* ------------------------------------------------------- l'authentification --- */

/**
 * `https://api.lemlist.com/api` — la racine documentée.
 *
 * `LEMLIST_BASE_URL` la remplace, et c'est **un joint de vérification, pas une
 * option de produit**. Sans lui, rien de ce module ne serait exercé hors
 * production : ni la pagination par `offset`, ni le recul sur un 429, ni le
 * message d'une clé refusée, ni la preuve que la clé ne sort pas. C'est
 * exactement le rôle qu'`ANTHROPIC_BASE_URL` a joué aux jalons 16 et 17, où un
 * substitut a fini par nommer le champ qu'une vraie API refusait.
 *
 * La variable n'est **pas** documentée dans `.env.example` comme un réglage :
 * elle n'a de sens que dans une recette, et la laisser vide est le cas normal.
 */
const BASE = (process.env.LEMLIST_BASE_URL ?? "").trim() || "https://api.lemlist.com/api";

/**
 * L'en-tête d'authentification, et le piège documenté.
 *
 * lemlist utilise **Basic**, pas Bearer, avec un **login vide** : la chaîne à
 * encoder est `:LaClé`, deux-points compris. L'oublier produit un 401 qu'on
 * met une demi-journée à comprendre.
 */
function authHeader(key: string): string {
  return `Basic ${Buffer.from(`:${key}`, "utf8").toString("base64")}`;
}

/** La clé, ou `null`. Lue à chaque appel, jamais mise en cache ni stockée. */
export function lemlistKey(): string | null {
  const raw = process.env.LEMLIST_API_KEY ?? "";
  const key = raw.trim();
  return key === "" ? null : key;
}

export function hasLemlistKey(): boolean {
  return lemlistKey() !== null;
}

/* ------------------------------------------------------------- les refus ------ */

/** Pourquoi un appel n'a pas abouti — un vocabulaire fermé, pas une chaîne libre. */
export const LEMLIST_FAILURES = ["missing_key", "refused", "rate_limited", "network", "server"] as const;
export type LemlistFailure = (typeof LEMLIST_FAILURES)[number];

export interface LemlistError {
  readonly kind: LemlistFailure;
  /** La phrase affichée, en français, **sans jamais citer la clé**. */
  readonly message: string;
  readonly status: number | null;
}

export type LemlistResult<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: LemlistError };

/**
 * Le message d'un statut HTTP, en français et sans secret.
 *
 * Le corps de la réponse **n'est pas repris** sur un 401 : voir la règle 2 en
 * tête de module. Sur les autres statuts il n'apporte rien que le code ne dise
 * déjà — lemlist y met « Bad params », « Bad team » —, et le reprendre
 * exposerait à recopier un en-tête que nous aurions nous-mêmes envoyé.
 */
function describeFailure(status: number): LemlistError {
  if (status === 401) {
    return {
      kind: "refused",
      status,
      message: "Clé refusée par lemlist. Vérifiez la variable LEMLIST_API_KEY du service.",
    };
  }
  if (status === 403) {
    return {
      kind: "refused",
      status,
      message:
        "lemlist a refusé l'accès (403) : la clé existe mais son utilisateur n'a pas le droit demandé.",
    };
  }
  if (status === 429) {
    return {
      kind: "rate_limited",
      status,
      message: "lemlist a imposé une pause (20 requêtes par 2 secondes) et les reprises ont échoué.",
    };
  }
  if (status === 400) {
    return {
      kind: "server",
      status,
      message: "lemlist a refusé la requête (400) : un paramètre ne lui convient pas.",
    };
  }
  return {
    kind: "server",
    status,
    message: `lemlist a répondu une erreur (${status}).`,
  };
}

/* ------------------------------------------------- la file et l'espacement ---- */

/**
 * Une requête toutes les `SPACING_MS` au plus vite.
 *
 * 20 requêtes par 2 secondes autorisent 100 ms d'écart ; on prend 150 ms. Ce
 * tiers de marge n'est pas de la prudence décorative : la clé est **la même**
 * que celle qu'un autre outil de l'utilisateur peut utiliser au même moment, et
 * un relevé de fond n'a aucune raison de lui prendre tout le budget.
 */
const SPACING_MS = 150;

/** Les reprises sur 429 ou panne réseau. Quatre, puis on renonce en le disant. */
const MAX_ATTEMPTS = 4;

let chain: Promise<unknown> = Promise.resolve();
let lastCallAt = 0;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Enchaîne un appel derrière les précédents, en respectant l'espacement.
 *
 * `chain` est au niveau du module, donc partagé par le webhook, le relevé et le
 * bouton « Tester la connexion » : les trois chemins ne peuvent pas se doubler.
 * C'est la même posture que le verrou d'une seule complétion par conversation
 * (jalon 2) — un `Set` au niveau du module plutôt qu'un espoir.
 */
function queue<T>(run: () => Promise<T>): Promise<T> {
  const next = chain.then(async () => {
    const since = Date.now() - lastCallAt;
    if (since < SPACING_MS) await wait(SPACING_MS - since);
    lastCallAt = Date.now();
    return run();
  });
  // La chaîne ne doit pas se rompre sur un échec, sinon l'espacement disparaît
  // pour tous les appels suivants.
  chain = next.catch(() => undefined);
  return next;
}

/**
 * Le nombre de secondes à attendre, lu dans `Retry-After`.
 *
 * `X-RateLimit-Reset` est volontairement ignoré : la documentation elle-même
 * attire l'attention sur son format humain, qui n'est pas analysable de façon
 * portable. Un en-tête absent ou illisible retombe sur le recul exponentiel.
 */
function retryAfterMs(headers: Headers, attempt: number): number {
  const raw = headers.get("retry-after");
  const seconds = raw === null ? Number.NaN : Number.parseInt(raw, 10);
  if (Number.isFinite(seconds) && seconds >= 0 && seconds <= 120) return seconds * 1000;
  return Math.min(2000 * 2 ** (attempt - 1), 16_000);
}

/* ------------------------------------------------------------- l'appel -------- */

/**
 * Un GET sur l'API lemlist, avec reprise.
 *
 * `version=v2` est posé **ici** et pas par les appelants : la documentation
 * prévient que certaines routes répondent encore en v1 par défaut, et une
 * réponse v1 n'a pas la même forme. Le poser au seul endroit qui construit
 * l'URL est ce qui empêche un appelant de l'oublier.
 */
async function get<T>(path: string, params: Record<string, string>): Promise<LemlistResult<T>> {
  const key = lemlistKey();
  if (key === null) {
    return {
      ok: false,
      error: {
        kind: "missing_key",
        status: null,
        message: MISSING_KEY_MESSAGE,
      },
    };
  }

  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("version", "v2");
  for (const [name, value] of Object.entries(params)) {
    if (value !== "") url.searchParams.set(name, value);
  }

  let lastError: LemlistError = {
    kind: "network",
    status: null,
    message: "lemlist est injoignable.",
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const outcome = await queue(async () => {
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: { Authorization: authHeader(key), Accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(30_000),
        });
        return { response } as const;
      } catch {
        // Le message de `fetch` porte parfois l'URL, et l'URL ne porte pas la
        // clé — mais on ne le reprend pas pour autant : il n'apprend rien à
        // l'utilisateur et rend le journal illisible.
        return { response: null } as const;
      }
    });

    if (outcome.response === null) {
      lastError = { kind: "network", status: null, message: "lemlist est injoignable." };
      if (attempt < MAX_ATTEMPTS) await wait(retryAfterMs(new Headers(), attempt));
      continue;
    }

    const { response } = outcome;
    if (response.ok) {
      const data = (await response.json()) as T;
      return { ok: true, data };
    }

    lastError = describeFailure(response.status);
    // Une clé refusée ne devient pas bonne en réessayant ; une pause, si.
    if (response.status === 429 || response.status >= 500) {
      if (attempt < MAX_ATTEMPTS) {
        await wait(retryAfterMs(response.headers, attempt));
        continue;
      }
    }
    return { ok: false, error: lastError };
  }

  return { ok: false, error: lastError };
}

/* ------------------------------------------------------- ce qu'on appelle ----- */

/** La page maximale documentée de `GET /activities`. */
export const ACTIVITIES_PAGE = 100;

export interface ActivityQuery {
  /** Borne basse sur `createdAt`, en ISO 8601 — le format documenté. */
  readonly minDate?: Date;
  readonly offset?: number;
  readonly limit?: number;
}

/**
 * `GET /api/activities?version=v2` — l'historique des activités.
 *
 * Pas de filtre `type` : on veut **tout**, y compris les types qu'on ne sait
 * pas encore traduire, pour pouvoir les nommer à l'écran. La documentation
 * précise qu'un type inconnu répond 400 ; ne pas filtrer, c'est aussi ne pas
 * dépendre de notre propre liste pour lire la réalité.
 *
 * La pagination est un `offset` à incrémenter, et non un curseur : c'est écrit
 * dans la documentation, et c'est ce que `readActivityPages` applique.
 */
export async function fetchActivities(query: ActivityQuery): Promise<LemlistResult<unknown[]>> {
  const params: Record<string, string> = {
    limit: String(query.limit ?? ACTIVITIES_PAGE),
    offset: String(query.offset ?? 0),
  };
  if (query.minDate !== undefined) params["minDate"] = query.minDate.toISOString();

  const result = await get<unknown>("/activities", params);
  if (!result.ok) return result;
  if (!Array.isArray(result.data)) {
    return {
      ok: false,
      error: {
        kind: "server",
        status: null,
        message: "lemlist a répondu autre chose qu'une liste d'activités.",
      },
    };
  }
  return { ok: true, data: result.data };
}

/**
 * `GET /api/team?version=v2` — l'appel du bouton « Tester la connexion ».
 *
 * Choisi parce qu'il est **le moins cher et le moins bavard** : il ne lit
 * aucune donnée personnelle de prospect, et sa seule réussite établit ce qu'on
 * veut savoir — la clé est acceptée. Aucun crédit n'est consommé.
 */
export async function fetchTeam(): Promise<LemlistResult<{ readonly name: string }>> {
  const result = await get<unknown>("/team", {});
  if (!result.ok) return result;
  const raw = result.data;
  const name =
    typeof raw === "object" && raw !== null && !Array.isArray(raw) && typeof (raw as Record<string, unknown>)["name"] === "string"
      ? ((raw as Record<string, unknown>)["name"] as string)
      : "";
  return { ok: true, data: { name } };
}

/**
 * Lit les activités page par page jusqu'à épuisement, en s'arrêtant net.
 *
 * `maxPages` est un garde-fou, pas une préférence : une reprise d'historique
 * sur un compte très ancien ne doit pas tourner indéfiniment dans une requête
 * HTTP. Atteindre la borne est **dit** par `truncated`, et le relevé suivant
 * reprendra où celui-ci s'est arrêté.
 */
export async function readActivityPages(
  minDate: Date | undefined,
  maxPages: number,
): Promise<LemlistResult<{ readonly raw: unknown[]; readonly truncated: boolean }>> {
  const raw: unknown[] = [];
  for (let page = 0; page < maxPages; page += 1) {
    const result = await fetchActivities({ minDate, offset: page * ACTIVITIES_PAGE });
    if (!result.ok) {
      // Une page qui échoue après plusieurs pages réussies : on rend ce qu'on a
      // **et** l'erreur serait perdue. On préfère l'erreur : le relevé ne
      // doit pas avancer sa borne sur un passage incomplet.
      return result;
    }
    raw.push(...result.data);
    if (result.data.length < ACTIVITIES_PAGE) {
      return { ok: true, data: { raw, truncated: false } };
    }
  }
  return { ok: true, data: { raw, truncated: true } };
}
