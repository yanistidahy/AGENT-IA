import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  DEFAULT_AMOUNT_CENTS,
  DEFAULT_LABEL,
  MAX_AMOUNT_CENTS,
  MIN_AMOUNT_CENTS,
  decideWebhookAction,
  firstChargeDate,
  isPlausibleToken,
  isSubscriptionStatus,
  type SubscriptionStatus,
  type SubscriptionView,
} from "@/lib/domain/subscriptions";
import { publicBaseUrl } from "@/lib/api/email-sends";
import {
  MISSING_MOLLIE_KEY_MESSAGE,
  createCustomer,
  createFirstPayment,
  createMollieSubscription,
  findSubscriptionByRef,
  getPayment,
  hasMollieKey,
  isTrustedCheckoutUrl,
} from "@/lib/api/mollie-client";

/**
 * Les abonnements mensuels Mollie — la couche de service.
 *
 * ## Le trajet d'un client
 *
 * 1. **Le lien** : depuis la fiche d'une société, on génère une ligne
 *    `pending` et un jeton. Rien n'est créé chez Mollie à ce stade.
 * 2. **La page publique** (`/api/abonnement/{jeton}`) : le client ouvre le lien
 *    et clique. C'est ce clic — un `POST` — qui crée le client et le premier
 *    paiement chez Mollie, pas l'ouverture de la page : un aperçu de lien
 *    (messagerie, antivirus) ne doit pas fabriquer des paiements.
 * 3. **Le premier paiement** : le vrai montant du premier mois, réglé tout de
 *    suite, ce qui crée le mandat de prélèvement.
 * 4. **Le webhook** : Mollie annonce que le paiement est réglé ; on le relit
 *    chez eux (`getPayment`), puis on crée l'abonnement mensuel, dont le premier
 *    prélèvement tombe **un mois plus tard**.
 *
 * ## Ce qui rend le webhook sûr à rejouer
 *
 * Mollie rejoue un webhook tant qu'il n'a pas reçu 200, et peut l'envoyer deux
 * fois en parallèle. Trois protections, de la plus fine à la plus grossière :
 * une **réclamation atomique** (`activationClaimedAt`, périmée au bout de dix
 * minutes) pour qu'un seul appel crée l'abonnement ; l'**adoption** d'un
 * abonnement déjà créé chez Mollie mais jamais noté chez nous ; et la clé
 * d'idempotence posée sur la création.
 */

const CLAIM_STALE_MS = 10 * 60 * 1000;
const WEBHOOK_PATH = "/api/mollie/webhook";

/* ---------------------------------------------------------------- entrées ---- */

export const createSubscriptionSchema = z.object({
  companyId: z.string().min(1),
  amountCents: z.number().int().min(MIN_AMOUNT_CENTS).max(MAX_AMOUNT_CENTS).optional(),
  label: z.string().trim().min(1).max(120).optional(),
});
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;

/* ------------------------------------------------------------------- vues ---- */

interface SubscriptionRow {
  readonly id: string;
  readonly companyId: string;
  readonly companyName: string;
  readonly token: string;
  readonly status: string;
  readonly amountCents: number;
  readonly label: string;
  readonly startDate: string | null;
  readonly activatedAt: Date | null;
  readonly lastPaymentStatus: string;
  readonly lastPaymentAt: Date | null;
  readonly createdAt: Date;
}

function readStatus(value: string): SubscriptionStatus {
  // Une valeur inconnue ne doit pas passer pour « actif » : la plus prudente.
  return isSubscriptionStatus(value) ? value : "pending";
}

function linkFor(token: string): string | null {
  const base = publicBaseUrl();
  return base === "" ? null : `${base}/api/abonnement/${token}`;
}

export function toView(row: SubscriptionRow): SubscriptionView {
  return {
    id: row.id,
    companyId: row.companyId,
    companyName: row.companyName,
    status: readStatus(row.status),
    amountCents: row.amountCents,
    label: row.label,
    createdAt: row.createdAt.toISOString(),
    activatedAt: row.activatedAt === null ? null : row.activatedAt.toISOString(),
    startDate: row.startDate,
    lastPaymentStatus: row.lastPaymentStatus,
    lastPaymentAt: row.lastPaymentAt === null ? null : row.lastPaymentAt.toISOString(),
    // Le lien n'a de sens que tant qu'on peut encore payer.
    link: row.status === "pending" ? linkFor(row.token) : null,
  };
}

export async function listSubscriptionsForCompany(companyId: string): Promise<SubscriptionView[]> {
  const rows = await prisma.subscription.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toView);
}

/* ------------------------------------------------------------ créer un lien -- */

export type CreateLinkResult =
  | { readonly ok: true; readonly view: SubscriptionView }
  | { readonly ok: false; readonly code: "not_found" | "conflict" | "unavailable"; readonly message: string };

/**
 * Génère le lien d'une société.
 *
 * Refusé tant que la clé Mollie ou l'adresse publique manque : un lien sans
 * adresse, ou qui échouerait au premier clic du client, est pire que pas de lien.
 */
export async function createSubscriptionLink(input: CreateSubscriptionInput): Promise<CreateLinkResult> {
  if (!hasMollieKey()) {
    return { ok: false, code: "unavailable", message: MISSING_MOLLIE_KEY_MESSAGE };
  }
  if (publicBaseUrl() === "") {
    return {
      ok: false,
      code: "unavailable",
      message: "L'adresse publique du CRM est inconnue. Ajoutez CRM_PUBLIC_URL aux variables du service.",
    };
  }

  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { id: true, name: true },
  });
  if (company === null) {
    return { ok: false, code: "not_found", message: "Société introuvable." };
  }

  const live = await prisma.subscription.findFirst({
    where: { companyId: company.id, status: { in: ["active", "past_due"] } },
    select: { id: true },
  });
  if (live !== null) {
    return { ok: false, code: "conflict", message: "Cette société a déjà un abonnement en cours." };
  }

  // Un lien neuf remplace les anciens liens **jamais utilisés** : deux liens
  // ouverts pour la même société, c'est deux façons de payer deux fois. Un lien
  // dont le paiement est commencé n'est pas touché.
  await prisma.subscription.updateMany({
    where: { companyId: company.id, status: "pending", mollieFirstPaymentId: null },
    data: { status: "canceled" },
  });

  const row = await prisma.subscription.create({
    data: {
      companyId: company.id,
      companyName: company.name,
      token: randomBytes(32).toString("base64url"),
      amountCents: input.amountCents ?? DEFAULT_AMOUNT_CENTS,
      label: input.label ?? DEFAULT_LABEL,
    },
  });
  return { ok: true, view: toView(row) };
}

/* ---------------------------------------------------------- page publique ---- */

export interface PublicView {
  readonly companyName: string;
  readonly amountCents: number;
  readonly label: string;
  readonly status: SubscriptionStatus;
  /** Un paiement a été commencé : la confirmation peut ne pas être arrivée. */
  readonly paymentStarted: boolean;
}

export async function getPublicView(token: string): Promise<PublicView | null> {
  if (!isPlausibleToken(token)) return null;
  const row = await prisma.subscription.findUnique({ where: { token } });
  if (row === null) return null;
  return {
    companyName: row.companyName,
    amountCents: row.amountCents,
    label: row.label,
    status: readStatus(row.status),
    paymentStarted: row.mollieFirstPaymentId !== null,
  };
}

export type CheckoutResult =
  | { readonly kind: "redirect"; readonly url: string }
  | { readonly kind: "unknown" }
  | { readonly kind: "not_payable"; readonly status: SubscriptionStatus }
  | { readonly kind: "error"; readonly message: string };

const CLOSED_PAYMENT = new Set(["failed", "canceled", "expired"]);

/**
 * Le clic du client : ouvre (ou rouvre) sa page de paiement chez Mollie.
 *
 * Un paiement déjà ouvert est **réutilisé** : cliquer deux fois, ou revenir en
 * arrière puis recliquer, ne crée pas un second paiement. Un paiement échoué,
 * abandonné ou expiré est remplacé — le lien reste valable, c'est tout son
 * intérêt.
 */
export async function beginCheckout(token: string): Promise<CheckoutResult> {
  if (!isPlausibleToken(token)) return { kind: "unknown" };
  const row = await prisma.subscription.findUnique({ where: { token } });
  if (row === null) return { kind: "unknown" };

  const status = readStatus(row.status);
  if (status !== "pending") return { kind: "not_payable", status };

  const base = publicBaseUrl();
  if (base === "" || !hasMollieKey()) {
    return { kind: "error", message: "Le paiement n'est pas disponible pour le moment." };
  }

  // Un paiement déjà commencé : s'il est encore ouvert, on y renvoie le client.
  if (row.mollieFirstPaymentId !== null) {
    const existing = await getPayment(row.mollieFirstPaymentId);
    if (existing.ok) {
      const payment = existing.data;
      if (payment.status === "paid") return { kind: "not_payable", status: "pending" };
      if (!CLOSED_PAYMENT.has(payment.status) && payment.checkoutUrl !== null) {
        if (isTrustedCheckoutUrl(payment.checkoutUrl)) {
          return { kind: "redirect", url: payment.checkoutUrl };
        }
        return { kind: "error", message: "Le paiement n'est pas disponible pour le moment." };
      }
    }
    // Illisible ou clos : on en crée un neuf ci-dessous.
  }

  let customerId = row.mollieCustomerId;
  if (customerId === null) {
    const customer = await createCustomer({
      name: row.companyName,
      companyId: row.companyId,
      subscriptionRef: row.id,
    });
    if (!customer.ok) {
      console.error("[mollie] création du client", customer.error.kind, customer.error.status);
      return { kind: "error", message: "Le paiement n'est pas disponible pour le moment." };
    }
    customerId = customer.data.id;
    await prisma.subscription.update({ where: { id: row.id }, data: { mollieCustomerId: customerId } });
  }

  const created = await createFirstPayment({
    customerId,
    amountCents: row.amountCents,
    description: row.label,
    redirectUrl: `${base}/api/abonnement/${row.token}?retour=1`,
    webhookUrl: `${base}${WEBHOOK_PATH}`,
    subscriptionRef: row.id,
  });
  if (!created.ok) {
    console.error("[mollie] création du paiement", created.error.kind, created.error.status);
    return { kind: "error", message: "Le paiement n'est pas disponible pour le moment." };
  }
  const payment = created.data;
  if (payment.checkoutUrl === null || !isTrustedCheckoutUrl(payment.checkoutUrl)) {
    console.error("[mollie] adresse de paiement refusée");
    return { kind: "error", message: "Le paiement n'est pas disponible pour le moment." };
  }

  await prisma.subscription.update({
    where: { id: row.id },
    data: { mollieFirstPaymentId: payment.id },
  });
  return { kind: "redirect", url: payment.checkoutUrl };
}

/* ------------------------------------------------------------------ webhook -- */

/**
 * - `ok`      : traité (ou rien à faire) — Mollie reçoit 200 et ne rejoue pas ;
 * - `ignored` : identifiant inconnu ou invalide — 200 aussi : rejouer ne le
 *               rendrait pas valide, et un 4xx ferait croire à un sondage ;
 * - `retry`   : échec transitoire — 500, pour que Mollie rejoue.
 */
export type WebhookOutcome = "ok" | "ignored" | "retry";

function todayAndTomorrowUtc(): { today: string; tomorrow: string } {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return { today: now.toISOString().slice(0, 10), tomorrow: tomorrow.toISOString().slice(0, 10) };
}

export async function applyPaymentWebhook(paymentId: string): Promise<WebhookOutcome> {
  // On ne croit pas le webhook : on relit le paiement chez Mollie, avec notre clé.
  const fetched = await getPayment(paymentId);
  if (!fetched.ok) {
    // 404 ou refus : un identifiant que Mollie ne connaît pas. Rien à rejouer.
    return fetched.error.kind === "rejected" ? "ignored" : "retry";
  }
  const payment = fetched.data;

  // Notre ligne : par la métadonnée posée à la création, à défaut (un
  // prélèvement mensuel n'hérite pas toujours des métadonnées) par l'abonnement.
  let row =
    payment.subscriptionRef === null
      ? null
      : await prisma.subscription.findUnique({ where: { id: payment.subscriptionRef } });
  if (row === null && payment.subscriptionId !== null) {
    row = await prisma.subscription.findUnique({ where: { mollieSubscriptionId: payment.subscriptionId } });
  }
  if (row === null) return "ignored";

  const action = decideWebhookAction(
    { status: payment.status, sequenceType: payment.sequenceType },
    { status: readStatus(row.status), mollieSubscriptionId: row.mollieSubscriptionId },
  );

  switch (action) {
    case "ignore":
    case "wait":
    case "already_activated":
      return "ok";

    case "note_only":
      await prisma.subscription.update({
        where: { id: row.id },
        data: { lastPaymentStatus: payment.status, lastPaymentAt: new Date() },
      });
      return "ok";

    case "record_paid":
      await prisma.subscription.update({
        where: { id: row.id },
        data: { status: "active", lastPaymentStatus: "paid", lastPaymentAt: payment.paidAt ?? new Date() },
      });
      return "ok";

    case "record_failed":
      await prisma.subscription.update({
        where: { id: row.id },
        data: { status: "past_due", lastPaymentStatus: payment.status, lastPaymentAt: new Date() },
      });
      return "ok";

    case "activate":
      return activate(row.id, payment);
  }
}

interface PaidFirstPayment {
  readonly id: string;
  readonly customerId: string | null;
  readonly mandateId: string | null;
  readonly paidAt: Date | null;
  readonly amountCents: number | null;
}

async function activate(subscriptionId: string, payment: PaidFirstPayment): Promise<WebhookOutcome> {
  const row = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (row === null) return "ignored";

  // Le paiement doit être celui de **cette** ligne, pour **ce** montant, chez ce
  // client. Un écart n'est pas rejoué (il ne se corrigera pas) : il est journalisé
  // et l'abonnement n'est pas créé — un humain tranche depuis le tableau de bord.
  if (
    payment.customerId === null ||
    (row.mollieCustomerId !== null && payment.customerId !== row.mollieCustomerId) ||
    payment.amountCents !== row.amountCents
  ) {
    console.error("[mollie] premier paiement incohérent avec la ligne", row.id);
    return "ignored";
  }
  const customerId = payment.customerId;
  const paidAt = payment.paidAt ?? new Date();

  // La réclamation : un seul appel passe, les autres attendent le rejeu.
  const staleBefore = new Date(Date.now() - CLAIM_STALE_MS);
  const claim = await prisma.subscription.updateMany({
    where: {
      id: row.id,
      status: "pending",
      mollieSubscriptionId: null,
      OR: [{ activationClaimedAt: null }, { activationClaimedAt: { lt: staleBefore } }],
    },
    data: { activationClaimedAt: new Date(), mollieCustomerId: customerId },
  });
  if (claim.count === 0) return "retry";

  try {
    // Adopter avant de créer : un abonnement déjà ouvert chez Mollie pour cette
    // ligne ne doit pas être doublé.
    const found = await findSubscriptionByRef(customerId, row.id);
    if (!found.ok) {
      await releaseClaim(row.id);
      return "retry";
    }

    let mollieSubscriptionId = found.data === null ? null : found.data.id;
    let startDate = row.startDate;

    if (mollieSubscriptionId === null) {
      const { today, tomorrow } = todayAndTomorrowUtc();
      const wanted = firstChargeDate(paidAt);
      // Un webhook très tardif ne doit pas demander une date passée.
      startDate = wanted > today ? wanted : tomorrow;

      const base = publicBaseUrl();
      const created = await createMollieSubscription({
        customerId,
        amountCents: row.amountCents,
        startDate,
        description: row.label,
        webhookUrl: `${base}${WEBHOOK_PATH}`,
        subscriptionRef: row.id,
      });
      if (!created.ok) {
        console.error("[mollie] création de l'abonnement", created.error.kind, created.error.status);
        await releaseClaim(row.id);
        return "retry";
      }
      mollieSubscriptionId = created.data.id;
    }

    await prisma.subscription.update({
      where: { id: row.id },
      data: {
        status: "active",
        mollieSubscriptionId,
        mollieMandateId: payment.mandateId,
        startDate,
        firstPaidAt: paidAt,
        activatedAt: new Date(),
        activationClaimedAt: null,
        lastPaymentStatus: "paid",
        lastPaymentAt: paidAt,
      },
    });
    return "ok";
  } catch (error) {
    console.error("[mollie] activation", error);
    await releaseClaim(row.id);
    return "retry";
  }
}

async function releaseClaim(id: string): Promise<void> {
  try {
    await prisma.subscription.update({ where: { id }, data: { activationClaimedAt: null } });
  } catch (error) {
    // Une réclamation non libérée se périme d'elle-même au bout de dix minutes.
    console.error("[mollie] libération de la réclamation", error);
  }
}
