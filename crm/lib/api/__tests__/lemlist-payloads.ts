/**
 * **Des charges utiles enregistrées, à la forme documentée, anonymisées.**
 *
 * Chaque objet reproduit la forme que la documentation de lemlist publie : les
 * exemples de réponse de `GET /api/activities` et la table des champs livrés
 * par un webhook (`_id`, `type`, `createdAt`, `campaignId`, `campaignName`,
 * `leadId`, `contactId`, `leadEmail` / `email`, `lead.variables.*`,
 * `sendUserName`, `subject`, `secret`).
 *
 * ## Pourquoi elles sont inventées, et pourquoi ce n'est pas un défaut
 *
 * Les activités réelles du compte portent des **noms, adresses et descriptions
 * de vrais prospects**. Les committer serait publier des données personnelles
 * dans un dépôt, pour le confort d'un test. Les valeurs sont donc fabriquées —
 * `anna.leroy@maison-leroy.fr`, `Maison Leroy` — et la **forme** est celle de la
 * documentation, champ pour champ, y compris les pièges qu'elle signale :
 *
 * - une activité **hors campagne** ne porte aucune clé `lead*` : elle a un
 *   `contactId` et des champs `email` / `firstName` lus sur le contact. C'est
 *   `linkedinOutsideCampaign` ci-dessous, et c'est ce cas qui casserait une
 *   lecture écrite pour le seul cas des campagnes ;
 * - `sequenceStep` et `totalSequenceStep` sont **indexés à zéro** ;
 * - `stepId` est facultatif sur les activités anciennes ;
 * - le `secret` d'un webhook voyage **dans le corps**, pas dans un en-tête.
 *
 * Ce que ces charges utiles **n'établissent pas** : que lemlist envoie bien ces
 * champs-là dans cet ordre-là, aujourd'hui. Seule la production le dira, et le
 * jalon le dit dans son résumé.
 */

/** Un envoi d'email dans une campagne : le cas le plus courant. */
export const emailSent = {
  _id: "act_PbKqTGpQqSlPcoOZ5",
  type: "emailsSent",
  teamId: "tea_8QvkOiBfPdb2ZRhHi",
  createdAt: "2026-11-02T09:12:04.318Z",
  leadId: "lea_fiDpiGV585wy3Oii2",
  contactId: "ctc_xW8Ou6C03Csv8vatp",
  campaignId: "cam_bSn8EORHQxbWPjHvu",
  campaignName: "E-commerce — Shopify (email d'abord)",
  sequenceId: "seq_Hh2KpLmNoPqRsTuVw",
  stepId: "stp_A1b2C3d4E5f6G7h8I",
  sequenceStep: 0,
  totalSequenceStep: 0,
  journeyDepth: 0,
  isFirst: true,
  bot: false,
  sendUserId: "usr_Emu1g29BMtBixhMSP",
  sendUserName: "YANIS TIDAHY",
  subject: "Votre boutique Maison Leroy",
  leadFirstName: "Anna",
  leadLastName: "Leroy",
  leadEmail: "Anna.Leroy@Maison-Leroy.fr",
  leadCompanyName: "Maison Leroy",
  to: [{ address: "anna.leroy@maison-leroy.fr", name: "Anna Leroy" }],
  metaData: {
    teamId: "tea_8QvkOiBfPdb2ZRhHi",
    campaignId: "cam_bSn8EORHQxbWPjHvu",
    leadId: "lea_fiDpiGV585wy3Oii2",
    type: "emailsSent",
  },
  lead: {
    _id: "lea_fiDpiGV585wy3Oii2",
    createdAt: "2026-10-28T08:07:38.375Z",
    isPaused: false,
    state: "emailsSent",
    personalized: false,
    source: "api",
    contactId: "ctc_xW8Ou6C03Csv8vatp",
    variables: {
      firstName: "Anna",
      lastName: "Leroy",
      email: "anna.leroy@maison-leroy.fr",
      jobTitle: "Fondatrice",
      companyName: "Maison Leroy",
      companyDomain: "maison-leroy.fr",
      linkedinUrl: "https://www.linkedin.com/in/anna-leroy/",
    },
  },
} as const;

/** Une réponse par email : le fait qui arrête une séquence du CRM. */
export const emailReplied = {
  _id: "act_j0NrG6rYEPP9TMmWC",
  type: "emailsReplied",
  teamId: "tea_8QvkOiBfPdb2ZRhHi",
  createdAt: "2026-11-03T14:41:52.000Z",
  leadId: "lea_fiDpiGV585wy3Oii2",
  contactId: "ctc_xW8Ou6C03Csv8vatp",
  campaignId: "cam_bSn8EORHQxbWPjHvu",
  campaignName: "E-commerce — Shopify (email d'abord)",
  sequenceStep: 0,
  sendUserName: "YANIS TIDAHY",
  subject: "Re: Votre boutique Maison Leroy",
  leadFirstName: "Anna",
  leadLastName: "Leroy",
  leadEmail: "anna.leroy@maison-leroy.fr",
  leadCompanyName: "Maison Leroy",
  to: [{ address: "yanis@auraflow.ai", name: "Yanis" }],
  lead: {
    _id: "lea_fiDpiGV585wy3Oii2",
    state: "emailsReplied",
    contactId: "ctc_xW8Ou6C03Csv8vatp",
    variables: {
      email: "anna.leroy@maison-leroy.fr",
      firstName: "Anna",
      lastName: "Leroy",
      companyName: "Maison Leroy",
      companyDomain: "maison-leroy.fr",
    },
  },
} as const;

/** Une ouverture : importée, comptée nulle part. */
export const emailOpened = {
  _id: "act_WeKrlIaQlBnM3LZ6G",
  type: "emailsOpened",
  teamId: "tea_8QvkOiBfPdb2ZRhHi",
  createdAt: "2026-11-02T10:02:11.904Z",
  leadId: "lea_fiDpiGV585wy3Oii2",
  contactId: "ctc_xW8Ou6C03Csv8vatp",
  campaignId: "cam_bSn8EORHQxbWPjHvu",
  campaignName: "E-commerce — Shopify (email d'abord)",
  leadEmail: "anna.leroy@maison-leroy.fr",
  leadFirstName: "Anna",
  leadLastName: "Leroy",
} as const;

/** Une invitation LinkedIn acceptée, avec son `relatedSentAt`. */
export const linkedinInviteAccepted = {
  _id: "act_Qr7TmNbVcXzAsDfGh",
  type: "linkedinInviteAccepted",
  teamId: "tea_8QvkOiBfPdb2ZRhHi",
  createdAt: "2026-11-04T08:30:00.000Z",
  relatedSentAt: "2026-10-30T09:00:00.000Z",
  emailTemplateName: "linkedinInvite",
  leadId: "lea_Zz9YyXxWwVvUuTtSs",
  contactId: "ctc_Nn8MmLlKkJjHhGgFf",
  campaignId: "cam_Rr5TtYyUuIiOoPpAa",
  campaignName: "Artisans — LinkedIn d'abord",
  sendUserName: "MOHAMED BEN SALEM",
  leadFirstName: "Pierre",
  leadLastName: "Vasseur",
  leadEmail: "",
  leadCompanyName: "Atelier Vasseur",
  lead: {
    _id: "lea_Zz9YyXxWwVvUuTtSs",
    state: "linkedinInviteAccepted",
    contactId: "ctc_Nn8MmLlKkJjHhGgFf",
    variables: {
      firstName: "Pierre",
      lastName: "Vasseur",
      companyName: "Atelier Vasseur",
      companyDomain: "atelier-vasseur.fr",
      linkedinUrl: "linkedin.com/in/pierre-vasseur",
    },
  },
} as const;

/**
 * **Une activité hors campagne** : aucune clé `lead*`, un `contactId` et les
 * champs du contact. La documentation prévient explicitement de ce cas, et
 * c'est lui qui casserait une lecture écrite pour les seules campagnes.
 */
export const linkedinOutsideCampaign = {
  _id: "act_Bb3CcDdEeFfGgHhIi",
  type: "linkedinSent",
  teamId: "tea_8QvkOiBfPdb2ZRhHi",
  createdAt: "2026-11-05T11:15:00.000Z",
  contactId: "ctc_Vv4WwXxYyZzAaBbCc",
  email: "claire.mercier@studio-mercier.com",
  firstName: "Claire",
  lastName: "Mercier",
  jobTitle: "Directrice",
  companyName: "Studio Mercier",
  companyDomain: "studio-mercier.com",
  linkedinUrl: "https://linkedin.com/in/claire-mercier/",
  sendUserName: "YANIS TIDAHY",
} as const;

/**
 * **Un type absent de la table** : `conditionChosen` existe bien dans
 * l'énumération publiée, mais ne correspond à aucun fait de prospection. Il
 * sert à vérifier que le seau `other` fonctionne et que l'écran le nomme.
 */
export const conditionChosen = {
  _id: "act_Dd6EeFfGgHhIiJjKk",
  type: "conditionChosen",
  teamId: "tea_8QvkOiBfPdb2ZRhHi",
  createdAt: "2026-11-05T11:16:00.000Z",
  contactId: "ctc_Vv4WwXxYyZzAaBbCc",
  email: "claire.mercier@studio-mercier.com",
  campaignId: "cam_Rr5TtYyUuIiOoPpAa",
  campaignName: "Artisans — LinkedIn d'abord",
} as const;

/**
 * **Un type que cette version ne connaît pas du tout.** lemlist en ajoutera ;
 * la règle est qu'il entre en « Autre activité » sous son vrai nom plutôt que
 * de disparaître.
 */
export const futureType = {
  _id: "act_Ff7GgHhIiJjKkLlMm",
  type: "telepathyDone",
  createdAt: "2026-11-05T12:00:00.000Z",
  contactId: "ctc_Vv4WwXxYyZzAaBbCc",
  email: "claire.mercier@studio-mercier.com",
} as const;

/** Une désinscription, nouvelle forme (depuis mars 2026). */
export const entityUnsubscribed = {
  _id: "act_Hh8IiJjKkLlMmNnOo",
  type: "entityUnsubscribed",
  createdAt: "2026-11-06T07:45:00.000Z",
  contactId: "ctc_xW8Ou6C03Csv8vatp",
  email: "anna.leroy@maison-leroy.fr",
  campaignId: "cam_bSn8EORHQxbWPjHvu",
  campaignName: "E-commerce — Shopify (email d'abord)",
} as const;

/** Une charge utile illisible : pas d'identifiant. */
export const withoutId = { type: "emailsSent", createdAt: "2026-11-02T09:00:00.000Z" } as const;

/** Une charge utile illisible : date absente. */
export const withoutDate = { _id: "act_Zz", type: "emailsSent" } as const;

/**
 * La charge utile d'un webhook, telle que lemlist la poste : l'activité, plus
 * le `secret` convenu à la création du webhook.
 */
export function webhookBody(
  activity: Readonly<Record<string, unknown>>,
  secret: string,
): Record<string, unknown> {
  return { ...activity, secret };
}

/** Tout ce que le relevé rendrait sur un compte de démonstration. */
export const ALL_PAYLOADS: readonly Record<string, unknown>[] = [
  emailSent,
  emailOpened,
  emailReplied,
  linkedinInviteAccepted,
  linkedinOutsideCampaign,
  conditionChosen,
  futureType,
  entityUnsubscribed,
];
