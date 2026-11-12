/**
 * Règles pures des abonnements Mollie (jalon 115).
 *
 * Ce fichier ne connaît ni Prisma, ni Mollie, ni React : il prend des faits et
 * rend une décision. C'est la même séparation que `lib/domain/follow-up.ts` ou
 * `lib/domain/lemlist.ts`, pour la même raison — les règles qui touchent à de
 * l'argent se testent sans base, sans réseau et sans clé.
 *
 * ## Le parcours, en une phrase
 *
 * Un lien par client → un premier paiement du **vrai montant** (qui crée le
 * mandat chez Mollie) → un webhook qui, **une fois ce paiement confirmé**,
 * crée l'abonnement mensuel, dont le premier prélèvement tombe un mois plus
 * tard. Les 14 jours d'essai se passent hors de Mollie : sans carte, il n'y a
 * pas de mandat, donc rien à prélever.
 */

/* ---------------------------------------------------------------- statuts --- */

/**
 * Le vocabulaire fermé de l'état d'un abonnement, stocké en `String` (pas
 * d'`enum` Prisma : voir CLAUDE.md, § Conventions).
 *
 * - `pending`  — lien généré, aucun paiement confirmé ;
 * - `active`   — premier paiement confirmé, abonnement créé chez Mollie ;
 * - `past_due` — un prélèvement récurrent a échoué ; repasse `active` au
 *   prélèvement suivant s'il réussit ;
 * - `canceled` — lien désactivé ou abonnement arrêté. Terminal : plus aucun
 *   événement ne le rouvre.
 */
export const SUBSCRIPTION_STATUSES = ["pending", "active", "past_due", "canceled"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  pending: "En attente de paiement",
  active: "Actif",
  past_due: "Paiement en retard",
  canceled: "Annulé",
};

export function isSubscriptionStatus(value: string): value is SubscriptionStatus {
  return (SUBSCRIPTION_STATUSES as readonly string[]).includes(value);
}

/* ---------------------------------------------------------------- montants -- */

/** Bornes d'un abonnement, en centimes : de 1 € à 5 000 € par mois. */
export const MIN_AMOUNT_CENTS = 100;
export const MAX_AMOUNT_CENTS = 500_000;

/** Le palier de la grille actuelle : 80 € par mois pour 10 000 visiteurs. */
export const DEFAULT_AMOUNT_CENTS = 8_000;

export const DEFAULT_LABEL = "Aura Flow AI — abonnement mensuel";

/** Le seul rythme proposé. Le format est celui de l'API Mollie. */
export const MOLLIE_INTERVAL = "1 month";

/**
 * Le montant au format de l'API Mollie : une chaîne à deux décimales, point
 * décimal — `"80.00"`, jamais un nombre. Mollie refuse un flottant, et pour une
 * bonne raison : `0.1 + 0.2` n'est pas `0.3`. Les centimes restent des entiers
 * jusqu'à cette ligne.
 */
export function mollieAmount(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new RangeError(`Montant invalide : ${String(cents)} centimes.`);
  }
  const euros = Math.floor(cents / 100);
  const rest = cents % 100;
  return `${euros}.${String(rest).padStart(2, "0")}`;
}

/**
 * L'opération inverse, pour **relire** ce que Mollie dit avoir encaissé. `null`
 * sur toute forme inattendue : on ne devine pas un montant.
 */
export function centsFromMollieAmount(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,7})\.(\d{2})$/.exec(value);
  if (match === null) return null;
  const euros = match[1];
  const rest = match[2];
  if (euros === undefined || rest === undefined) return null;
  return Number.parseInt(euros, 10) * 100 + Number.parseInt(rest, 10);
}

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** « 80,00 € » — pour l'écran. */
export function formatAmount(cents: number): string {
  return EUR.format(cents / 100);
}

/**
 * Ce que l'utilisateur a tapé dans le champ « Montant mensuel », en euros, vers
 * des centimes. `null` si c'est illisible ou hors bornes.
 *
 * Virgule ou point, espaces tolérés (« 1 200,50 »). Jamais plus de deux
 * décimales : « 80,999 » est une faute de frappe, pas un montant à arrondir en
 * silence.
 */
export function parseEuroInput(text: string): number | null {
  const compact = text.replace(/[\s  ]/g, "");
  if (!/^\d{1,6}([.,]\d{1,2})?$/.test(compact)) return null;
  const cents = Math.round(Number(compact.replace(",", ".")) * 100);
  if (!Number.isFinite(cents)) return null;
  if (cents < MIN_AMOUNT_CENTS || cents > MAX_AMOUNT_CENTS) return null;
  return cents;
}

/* ------------------------------------------------------------------ dates --- */

const PARIS_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function parisYmd(date: Date): { year: number; month: number; day: number } {
  let year = 0;
  let month = 0;
  let day = 0;
  for (const part of PARIS_DAY.formatToParts(date)) {
    if (part.type === "year") year = Number(part.value);
    else if (part.type === "month") month = Number(part.value);
    else if (part.type === "day") day = Number(part.value);
  }
  return { year, month, day };
}

const two = (n: number): string => String(n).padStart(2, "0");

/**
 * Le jour du **premier prélèvement de l'abonnement** : un mois après le jour du
 * paiement, au calendrier de Paris.
 *
 * Le premier mois est déjà payé par le premier paiement ; l'abonnement ne doit
 * donc pas prélever le jour même. Deux pièges, tous deux testés :
 *
 * - **le calendrier est celui de Paris**, pas celui du serveur : un paiement à
 *   00 h 30 heure de Paris est encore la veille en UTC, et décalerait l'échéance
 *   d'un jour ;
 * - **le 31 janvier + 1 mois n'existe pas.** On retombe sur le dernier jour du
 *   mois suivant (28 ou 29 février), au lieu de laisser un `Date` déborder sur
 *   mars en silence.
 *
 * Format `YYYY-MM-DD`, celui du champ `startDate` de Mollie.
 */
export function firstChargeDate(paidAt: Date): string {
  const { year, month, day } = parisYmd(paidAt);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  // Jour 0 du mois suivant = dernier jour du mois `nextMonth`.
  const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  return `${nextYear}-${two(nextMonth)}-${two(Math.min(day, lastDay))}`;
}

/* ----------------------------------------------------------------- jetons --- */

/**
 * Un jeton de lien plausible : 32 octets aléatoires en base64url, soit 43
 * caractères. Sert à écarter d'emblée ce qui n'a aucune chance d'exister avant
 * de toucher la base — pas à authentifier : l'authentification, c'est que le
 * jeton soit **inconnu de quiconque ne l'a pas reçu**.
 */
export function isPlausibleToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

/** Un identifiant de paiement Mollie : `tr_` puis des caractères alphanumériques. */
export function isMolliePaymentId(value: string): boolean {
  return /^tr_[A-Za-z0-9]{4,64}$/.test(value);
}

/* ---------------------------------------------------------------- le webhook -- */

/** Ce que le webhook doit faire d'un paiement relu chez Mollie. */
export type WebhookAction =
  /** Premier paiement confirmé, abonnement pas encore créé : le créer. */
  | "activate"
  /** Premier paiement confirmé, mais l'abonnement existe déjà : rien à créer. */
  | "already_activated"
  /** Prélèvement mensuel réussi. */
  | "record_paid"
  /** Prélèvement mensuel refusé, expiré ou annulé. */
  | "record_failed"
  /** Premier paiement refusé ou abandonné : on le note, le lien reste valable. */
  | "note_only"
  /** Paiement encore ouvert : on attend l'appel suivant de Mollie. */
  | "wait"
  /** Rien à faire : abonnement annulé, ou paiement d'une autre nature. */
  | "ignore";

export interface PaymentFacts {
  /** `open`, `pending`, `authorized`, `paid`, `failed`, `canceled`, `expired`. */
  readonly status: string;
  /** `first`, `recurring` ou `oneoff`. */
  readonly sequenceType: string;
}

export interface SubscriptionFacts {
  readonly status: SubscriptionStatus;
  readonly mollieSubscriptionId: string | null;
}

/**
 * La décision, en une fonction pure.
 *
 * **Un abonnement annulé ne se rouvre jamais**, quel que soit le paiement qui
 * arrive : une annulation est un geste humain, et un webhook tardif ne doit pas
 * le défaire.
 *
 * **Un premier paiement qui échoue ne tue pas le lien.** Le client peut
 * renvoyer une autre carte ; si l'échec marquait l'abonnement comme mort, il
 * faudrait régénérer un lien pour une carte refusée, ce qui est exactement le
 * frottement qu'un lien unique évite.
 */
export function decideWebhookAction(
  payment: PaymentFacts,
  subscription: SubscriptionFacts,
): WebhookAction {
  if (subscription.status === "canceled") return "ignore";

  const first = payment.sequenceType === "first";
  const recurring = payment.sequenceType === "recurring";

  switch (payment.status) {
    case "paid":
      if (first) return subscription.mollieSubscriptionId === null ? "activate" : "already_activated";
      return recurring ? "record_paid" : "ignore";
    case "failed":
    case "canceled":
    case "expired":
      if (first) return "note_only";
      return recurring ? "record_failed" : "ignore";
    default:
      return "wait";
  }
}

/* ----------------------------------------------------------- vue publique ---- */

/**
 * La forme d'un abonnement telle que l'écran la reçoit : dates en texte ISO
 * (JSON n'a pas de type date), et **jamais** un identifiant Mollie ni le
 * jeton — le lien complet est déjà assemblé par le serveur.
 */
export interface SubscriptionView {
  readonly id: string;
  readonly companyId: string;
  readonly companyName: string;
  readonly status: SubscriptionStatus;
  readonly amountCents: number;
  readonly label: string;
  readonly createdAt: string;
  readonly activatedAt: string | null;
  readonly startDate: string | null;
  readonly lastPaymentStatus: string;
  readonly lastPaymentAt: string | null;
  /** `null` quand l'adresse publique du CRM est inconnue : pas de lien deviné. */
  readonly link: string | null;
}

/* ------------------------------------------------------------------- HTML ---- */

/**
 * Échappe un texte destiné à une page HTML servie par la route publique. Le nom
 * d'une société vient d'un import de tableur : il n'est jamais de confiance.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
