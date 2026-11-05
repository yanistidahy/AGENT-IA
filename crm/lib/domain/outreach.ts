/**
 * **Le vocabulaire du journal d'événements, et rien d'autre.**
 *
 * Pur, sans Prisma : les unions, les libellés et les gardes de conversion
 * `string` → union, à l'endroit où ce projet les met depuis le jalon 0. C'est
 * `lib/domain/schemas.ts` qui porte les `z.enum()`, et ce module qui porte ce
 * qu'ils contiennent.
 *
 * Les six canaux sont **exactement** ceux de lemlist, et c'est volontaire : la
 * synchronisation du jalon suivant posera ses lignes sans table de
 * correspondance à inventer. Un canal du CRM qui n'y entre pas — le DM
 * Instagram — tombe dans `other` en nommant son origine dans `detail`, plutôt
 * que d'ajouter un septième canal que lemlist ne connaît pas.
 */

/* --------------------------------------------------------- les canaux ----- */

export const OUTREACH_CHANNELS = [
  "email",
  "linkedin_invite",
  "linkedin_message",
  "whatsapp",
  "call",
  "other",
] as const;
export type OutreachChannel = (typeof OUTREACH_CHANNELS)[number];

export const CHANNEL_LABELS: Record<OutreachChannel, string> = {
  email: "Email",
  linkedin_invite: "Invitation LinkedIn",
  linkedin_message: "Message LinkedIn",
  whatsapp: "WhatsApp",
  call: "Appel",
  other: "Autre",
};

export function isOutreachChannel(value: string): value is OutreachChannel {
  return (OUTREACH_CHANNELS as readonly string[]).includes(value);
}

/** Un canal inconnu devient `other` : une mesure ne doit pas lever. */
export function toChannel(value: string): OutreachChannel {
  return isOutreachChannel(value) ? value : "other";
}

/* ----------------------------------------------------------- les types ---- */

export const OUTREACH_TYPES = [
  "message_sent",
  "linkedin_invite_sent",
  "linkedin_invite_accepted",
  "reply_received",
  "bounce",
  "demo_sent",
  "demo_tested",
  "feedback_received",
  "meeting_booked",
  "meeting_held",
  "trial_started",
  "customer_won",
] as const;
export type OutreachType = (typeof OUTREACH_TYPES)[number];

export const TYPE_LABELS: Record<OutreachType, string> = {
  message_sent: "Message envoyé",
  linkedin_invite_sent: "Invitation LinkedIn envoyée",
  linkedin_invite_accepted: "Invitation LinkedIn acceptée",
  reply_received: "Réponse reçue",
  bounce: "Message rejeté",
  demo_sent: "Démo envoyée",
  demo_tested: "Démo testée",
  feedback_received: "Retour reçu",
  meeting_booked: "Rendez-vous obtenu",
  meeting_held: "Rendez-vous tenu",
  trial_started: "Essai démarré",
  customer_won: "Client gagné",
};

export function isOutreachType(value: string): value is OutreachType {
  return (OUTREACH_TYPES as readonly string[]).includes(value);
}

/* --------------------------------------------------------- les sources ---- */

export const OUTREACH_SOURCES = ["crm", "lemlist", "manual"] as const;
export type OutreachSource = (typeof OUTREACH_SOURCES)[number];

export const SOURCE_LABELS: Record<OutreachSource, string> = {
  crm: "CRM",
  lemlist: "lemlist",
  manual: "Saisi à la main",
};

export function isOutreachSource(value: string): value is OutreachSource {
  return (OUTREACH_SOURCES as readonly string[]).includes(value);
}

/* ------------------------------------------- les catégories de réponse ---- */

/**
 * **Posées à la main, jamais devinées.**
 *
 * Classer une réponse d'après son texte demanderait de lire le message, ce que
 * le produit ne fait pas (jalon 41 : le relevé ne voit que des en-têtes), et
 * une catégorie fausse se propagerait dans « réponse positive » — c'est-à-dire
 * dans le seul chiffre qui décide d'insister ou de renoncer. Tant que personne
 * n'a tranché, la réponse est **non catégorisée**, et l'écran le compte comme
 * tel plutôt que de la ranger ailleurs.
 */
export const REPLY_CATEGORIES = [
  "interested",
  "not_now",
  "not_interested",
  "already_equipped",
  "wrong_person",
  "unsubscribe",
  "out_of_office",
] as const;
export type ReplyCategory = (typeof REPLY_CATEGORIES)[number];

export const REPLY_CATEGORY_LABELS: Record<ReplyCategory, string> = {
  interested: "Intéressé",
  not_now: "Pas maintenant",
  not_interested: "Pas intéressé",
  already_equipped: "Déjà équipé",
  wrong_person: "Mauvais interlocuteur",
  unsubscribe: "Désinscription",
  out_of_office: "Absent du bureau",
};

/** Le libellé de l'absence de catégorie, écrit une fois. */
export const UNCATEGORISED_LABEL = "Non catégorisée";

export function isReplyCategory(value: string): value is ReplyCategory {
  return (REPLY_CATEGORIES as readonly string[]).includes(value);
}

/**
 * **Une seule catégorie compte comme positive.**
 *
 * « Pas maintenant » est une porte entrouverte, pas un oui : la compter
 * gonflerait le seul chiffre sur lequel on décide de continuer une campagne.
 * « Absent du bureau » n'est même pas une réponse d'humain, et il est déjà
 * écarté du relevé (jalon 41) — il n'apparaît ici que posé à la main.
 */
export function isPositiveReply(category: string): boolean {
  return category === "interested";
}

export function replyCategoryLabel(category: string): string {
  return isReplyCategory(category) ? REPLY_CATEGORY_LABELS[category] : UNCATEGORISED_LABEL;
}
