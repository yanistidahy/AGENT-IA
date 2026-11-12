import "server-only";
import { MOLLIE_INTERVAL, centsFromMollieAmount, mollieAmount } from "../domain/subscriptions";

/**
 * **Le seul endroit du code qui lit `MOLLIE_API_KEY`.**
 *
 * Même discipline que `lib/api/lemlist-client.ts` pour la clé lemlist et
 * `lib/agents/runtime/client.ts` pour la clé Anthropic, et pour la même raison :
 * une clé qui part dans un paquet JavaScript est publiée, pas fuitée.
 * `import "server-only"` fait échouer le build si un composant client importe ce
 * fichier, et `tests/mollie-source.test.ts` vérifie le reste :
 *
 * 1. **un seul lecteur** — aucun autre fichier ne mentionne la variable ;
 * 2. **la clé ne sert qu'à composer l'en-tête `Authorization`** — jamais
 *    interpolée ailleurs, jamais dans un message d'erreur, jamais journalisée ;
 * 3. **un 401 se dit sans se citer** — « clé refusée », rien de plus.
 *
 * ## Test ou production, c'est la clé qui décide
 *
 * Mollie n'a pas deux adresses : la même API répond en mode test avec une clé
 * `test_…` et en mode réel avec une clé `live_…`. Aucun drapeau de ce côté ;
 * passer en réel, c'est changer la variable du service, rien d'autre.
 *
 * ## Pas de reprise automatique, et c'est voulu
 *
 * Contrairement au client lemlist, rien n'est rejoué ici. Un `POST` qui crée un
 * client, un paiement ou un abonnement ne se rejoue pas à l'aveugle : si la
 * première tentative est partie sans que la réponse revienne, la rejouer
 * ouvrirait un doublon d'argent. Les erreurs remontent à l'appelant, qui sait
 * quoi en faire — et le webhook, lui, est rejoué par Mollie lui-même.
 */

/**
 * La racine de l'API, et son joint de vérification.
 *
 * `MOLLIE_BASE_URL` remplace la racine par un substitut local. Même statut que
 * `LEMLIST_BASE_URL` : **un joint de recette, pas une option de produit**. Vide
 * en production, et c'est le cas normal. Sans lui, rien de ce module ne serait
 * exercé hors de chez Mollie.
 */
const BASE = (process.env.MOLLIE_BASE_URL ?? "").trim() || "https://api.mollie.com/v2";

export const MISSING_MOLLIE_KEY_MESSAGE =
  "La clé Mollie n'est pas configurée. Ajoutez MOLLIE_API_KEY aux variables du service.";

/** La clé, ou `null`. Lue à chaque appel, jamais mise en cache ni stockée. */
export function mollieKey(): string | null {
  const key = (process.env.MOLLIE_API_KEY ?? "").trim();
  return key === "" ? null : key;
}

export function hasMollieKey(): boolean {
  return mollieKey() !== null;
}

/**
 * La page de paiement vers laquelle on redirige un visiteur doit être **chez
 * Mollie**. L'adresse vient de leur réponse, mais une redirection ouverte est
 * trop chère pour se contenter de la croire : on vérifie le schéma et l'hôte.
 * Avec le joint de recette (`MOLLIE_BASE_URL` posé), l'hôte est celui du
 * substitut local et la vérification d'hôte s'efface — jamais en production.
 */
export function isTrustedCheckoutUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if ((process.env.MOLLIE_BASE_URL ?? "").trim() !== "") {
    return url.protocol === "https:" || url.protocol === "http:";
  }
  return url.protocol === "https:" && (url.hostname === "mollie.com" || url.hostname.endsWith(".mollie.com"));
}

/* ---------------------------------------------------------------- refus ----- */

export const MOLLIE_FAILURES = ["missing_key", "refused", "rejected", "network", "server"] as const;
export type MollieFailure = (typeof MOLLIE_FAILURES)[number];

export interface MollieError {
  readonly kind: MollieFailure;
  /** La phrase affichée, en français, **sans jamais citer la clé**. */
  readonly message: string;
  readonly status: number | null;
}

export type MollieResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: MollieError };

function fail<T>(error: MollieError): MollieResult<T> {
  return { ok: false, error };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return { ...value };
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Le message d'un statut HTTP.
 *
 * Le corps n'est **pas** repris sur un 401 (voir la règle 3 en tête de fichier).
 * Sur un 422 en revanche, Mollie nomme le champ refusé et pourquoi — c'est
 * l'information utile, et elle ne contient jamais la clé.
 */
function describeFailure(status: number, payload: unknown): MollieError {
  if (status === 401) {
    return {
      kind: "refused",
      status,
      message: "Clé refusée par Mollie. Vérifiez la variable MOLLIE_API_KEY du service.",
    };
  }
  if (status === 403) {
    return {
      kind: "refused",
      status,
      message: "Mollie a refusé l'accès (403) : la clé n'a pas le droit demandé.",
    };
  }
  if (status === 404) {
    return { kind: "rejected", status, message: "Mollie ne connaît pas cette ressource (404)." };
  }
  if (status === 422 || status === 400) {
    const body = asRecord(payload);
    const detail = body === null ? "" : text(body["detail"]).slice(0, 240);
    const field = body === null ? "" : text(body["field"]);
    return {
      kind: "rejected",
      status,
      message:
        detail === ""
          ? `Mollie a refusé la requête (${status}).`
          : `Mollie a refusé la requête : ${detail}${field === "" ? "" : ` (champ ${field})`}`,
    };
  }
  return { kind: "server", status, message: `Mollie a répondu une erreur (${status}).` };
}

/* ---------------------------------------------------------------- l'appel --- */

async function call(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  idempotencyKey?: string,
): Promise<MollieResult<unknown>> {
  const key = mollieKey();
  if (key === null) {
    return fail({ kind: "missing_key", status: null, message: MISSING_MOLLIE_KEY_MESSAGE });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotencyKey !== undefined) headers["Idempotency-Key"] = idempotencyKey;

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    // Le message de `fetch` n'apprend rien à l'utilisateur et rend le journal
    // illisible : on ne le reprend pas.
    return fail({ kind: "network", status: null, message: "Mollie est injoignable." });
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) return fail(describeFailure(response.status, payload));
  return { ok: true, data: payload };
}

/* -------------------------------------------------------------- les objets -- */

export interface MolliePayment {
  readonly id: string;
  /** `open`, `pending`, `authorized`, `paid`, `failed`, `canceled`, `expired`. */
  readonly status: string;
  /** `first`, `recurring` ou `oneoff`. */
  readonly sequenceType: string;
  readonly customerId: string | null;
  readonly subscriptionId: string | null;
  readonly mandateId: string | null;
  readonly paidAt: Date | null;
  /** Le montant, relu en centimes ; `null` si la forme n'est pas celle attendue. */
  readonly amountCents: number | null;
  /** La page de paiement hébergée par Mollie, présente sur un paiement ouvert. */
  readonly checkoutUrl: string | null;
  /** Notre identifiant d'abonnement, recopié dans les métadonnées à la création. */
  readonly subscriptionRef: string | null;
}

function nullable(value: string): string | null {
  return value === "" ? null : value;
}

function parsePayment(raw: unknown): MolliePayment | null {
  const row = asRecord(raw);
  if (row === null) return null;

  const id = text(row["id"]);
  const status = text(row["status"]);
  if (id === "" || status === "") return null;

  const links = asRecord(row["_links"]);
  const checkout = links === null ? null : asRecord(links["checkout"]);
  const amount = asRecord(row["amount"]);
  const metadata = asRecord(row["metadata"]);

  const paidAtText = text(row["paidAt"]);
  const paidAtDate = paidAtText === "" ? null : new Date(paidAtText);
  const paidAt = paidAtDate !== null && !Number.isNaN(paidAtDate.getTime()) ? paidAtDate : null;

  return {
    id,
    status,
    sequenceType: text(row["sequenceType"]),
    customerId: nullable(text(row["customerId"])),
    subscriptionId: nullable(text(row["subscriptionId"])),
    mandateId: nullable(text(row["mandateId"])),
    paidAt,
    amountCents: amount === null ? null : centsFromMollieAmount(amount["value"]),
    checkoutUrl: checkout === null ? null : nullable(text(checkout["href"])),
    subscriptionRef: metadata === null ? null : nullable(text(metadata["subscriptionRef"])),
  };
}

/* ------------------------------------------------------------ les appels ---- */

/** `POST /customers` — le client qui portera le mandat. */
export async function createCustomer(input: {
  readonly name: string;
  readonly companyId: string;
  readonly subscriptionRef: string;
}): Promise<MollieResult<{ readonly id: string }>> {
  const result = await call("POST", "/customers", {
    name: input.name,
    // Pour pouvoir reconstruire le lien depuis le tableau de bord Mollie si la
    // base est perdue : c'est tout ce que ces deux champs servent à faire.
    metadata: { companyId: input.companyId, subscriptionRef: input.subscriptionRef },
  });
  if (!result.ok) return result;

  const row = asRecord(result.data);
  const id = row === null ? "" : text(row["id"]);
  if (id === "") {
    return fail({ kind: "server", status: null, message: "Mollie n'a pas renvoyé d'identifiant de client." });
  }
  return { ok: true, data: { id } };
}

/**
 * `POST /payments` avec `sequenceType: "first"` — le paiement qui, une fois
 * réglé, crée le mandat et déclenche la suite.
 *
 * C'est le **vrai montant** du premier mois, pas un paiement à zéro : les 14
 * jours d'essai se passent avant ce lien, sans carte. Le Checkout de Mollie ne
 * propose que les moyens de paiement capables de créer un mandat.
 */
export async function createFirstPayment(input: {
  readonly customerId: string;
  readonly amountCents: number;
  readonly description: string;
  readonly redirectUrl: string;
  readonly webhookUrl: string;
  readonly subscriptionRef: string;
}): Promise<MollieResult<MolliePayment>> {
  const result = await call("POST", "/payments", {
    amount: { currency: "EUR", value: mollieAmount(input.amountCents) },
    customerId: input.customerId,
    sequenceType: "first",
    description: input.description,
    redirectUrl: input.redirectUrl,
    webhookUrl: input.webhookUrl,
    locale: "fr_FR",
    metadata: { subscriptionRef: input.subscriptionRef },
  });
  if (!result.ok) return result;

  const payment = parsePayment(result.data);
  if (payment === null || payment.checkoutUrl === null) {
    return fail({
      kind: "server",
      status: null,
      message: "Mollie n'a pas renvoyé de page de paiement.",
    });
  }
  return { ok: true, data: payment };
}

/**
 * `GET /payments/{id}` — **la seule façon de croire un webhook.**
 *
 * Le webhook de Mollie ne porte qu'un identifiant : aucun statut, aucun
 * montant, aucune signature. Ce qu'il dit ne vaut donc rien ; ce que Mollie
 * répond ici, avec notre clé, vaut tout. Quiconque appellerait notre webhook
 * avec un identifiant inventé obtient un 404 de Mollie, et rien n'est écrit.
 */
export async function getPayment(id: string): Promise<MollieResult<MolliePayment>> {
  const result = await call("GET", `/payments/${encodeURIComponent(id)}`);
  if (!result.ok) return result;

  const payment = parsePayment(result.data);
  if (payment === null) {
    return fail({ kind: "server", status: null, message: "Mollie a répondu autre chose qu'un paiement." });
  }
  return { ok: true, data: payment };
}

export interface MollieSubscription {
  readonly id: string;
  readonly status: string;
}

function parseSubscription(raw: unknown): MollieSubscription | null {
  const row = asRecord(raw);
  if (row === null) return null;
  const id = text(row["id"]);
  if (id === "") return null;
  return { id, status: text(row["status"]) };
}

/**
 * `GET /customers/{id}/subscriptions` — retrouve l'abonnement qu'on aurait
 * **déjà** créé pour cette ligne, par sa métadonnée.
 *
 * Existe pour un seul cas : Mollie a créé l'abonnement, mais l'écriture en base
 * qui devait s'en souvenir a échoué. Au rejeu du webhook, on **adopte**
 * l'abonnement existant au lieu d'en créer un second — ce qui doublerait les
 * prélèvements.
 */
export async function findSubscriptionByRef(
  customerId: string,
  subscriptionRef: string,
): Promise<MollieResult<MollieSubscription | null>> {
  const result = await call("GET", `/customers/${encodeURIComponent(customerId)}/subscriptions`);
  if (!result.ok) return result;

  const body = asRecord(result.data);
  const embedded = body === null ? null : asRecord(body["_embedded"]);
  const list = embedded === null ? null : embedded["subscriptions"];
  if (!Array.isArray(list)) return { ok: true, data: null };

  for (const entry of list) {
    const row = asRecord(entry);
    if (row === null) continue;
    const metadata = asRecord(row["metadata"]);
    if (metadata === null || text(metadata["subscriptionRef"]) !== subscriptionRef) continue;
    const parsed = parseSubscription(row);
    // Une ligne annulée ou terminée n'est pas un abonnement à adopter.
    if (parsed !== null && (parsed.status === "active" || parsed.status === "pending")) {
      return { ok: true, data: parsed };
    }
  }
  return { ok: true, data: null };
}

/**
 * `POST /customers/{id}/subscriptions` — l'abonnement mensuel.
 *
 * `startDate` est le jour du **premier prélèvement de l'abonnement**, un mois
 * après le premier paiement déjà encaissé (`firstChargeDate`). `Idempotency-Key`
 * est posé : si la même requête repart, Mollie rend la même réponse au lieu d'en
 * créer une seconde.
 */
export async function createMollieSubscription(input: {
  readonly customerId: string;
  readonly amountCents: number;
  readonly startDate: string;
  readonly description: string;
  readonly webhookUrl: string;
  readonly subscriptionRef: string;
}): Promise<MollieResult<MollieSubscription>> {
  const result = await call(
    "POST",
    `/customers/${encodeURIComponent(input.customerId)}/subscriptions`,
    {
      amount: { currency: "EUR", value: mollieAmount(input.amountCents) },
      interval: MOLLIE_INTERVAL,
      startDate: input.startDate,
      description: input.description,
      webhookUrl: input.webhookUrl,
      metadata: { subscriptionRef: input.subscriptionRef },
    },
    `crm-subscription-${input.subscriptionRef}`,
  );
  if (!result.ok) return result;

  const subscription = parseSubscription(result.data);
  if (subscription === null) {
    return fail({ kind: "server", status: null, message: "Mollie n'a pas renvoyé d'identifiant d'abonnement." });
  }
  return { ok: true, data: subscription };
}
