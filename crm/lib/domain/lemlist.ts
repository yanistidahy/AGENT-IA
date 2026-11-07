/**
 * **La correspondance lemlist → journal de prospection, écrite une fois.**
 *
 * Pur, sans Prisma et sans réseau : la table se lit, se teste et se conteste
 * sans clé d'API. C'est le préalable que le jalon demandait avant toute ligne
 * de synchronisation — et c'est aussi la seule chose qui décide ce que
 * `/pilotage` comptera.
 *
 * ## Les trois sources, et ce qu'elles valent
 *
 * 1. **`ActivityType`** — l'énumération publiée du champ `type` de
 *    `GET /api/activities` (113 valeurs, recopiées ci-dessous telles quelles).
 *    C'est le vocabulaire que la synchronisation rencontre réellement.
 * 2. **Les événements de webhook** — la liste de `POST /api/hooks`. Elle
 *    recoupe largement la première, mais porte **six agrégats d'état de lead**
 *    (`contacted`, `hooked`, `attracted`, `warmed`, `interested`,
 *    `notInterested`) et une quinzaine d'événements d'espace de travail qui ne
 *    sont pas des activités.
 * 3. **La définition lemlist de « envoyé »**, lue dans les statistiques de
 *    campagne : `emailsSent + linkedinSent + linkedinInMailSent +
 *    linkedinVoiceNoteDone + smsSent + whatsappMessageSent`. **C'est elle qui
 *    décide de `message_sent`**, et non mon jugement : reprendre la définition
 *    de la source est la seule façon de ne pas inventer un second compte.
 *
 * ## Les quatre refus qui structurent la table
 *
 * Chacun évite un **double compte**, c'est-à-dire la seule erreur qui rend un
 * tableau de bord faux sans qu'aucun test ne rougisse (leçon du jalon 109) :
 *
 * - **la famille `*Done` n'est pas un envoi.** `emailsDone`, `linkedinDone`,
 *   `whatsappDone`, `smsDone`, `manualDone`, `aircallDone` marquent une
 *   **tâche achevée**, pendant que l'envoi lui-même porte son propre type
 *   (`emailsSent`, `linkedinSent`…). Les compter tous deux doublerait chaque
 *   message. Trois exceptions assumées, parce que lemlist n'émet **rien**
 *   d'autre pour ces gestes : `linkedinVoiceNoteDone` (que les statistiques
 *   lemlist comptent elles-mêmes comme un envoi), `linkedinInviteDone`
 *   (il n'existe pas de `linkedinInviteSent`) et `aircallEnded` (un appel qui
 *   a eu lieu) ;
 * - **`emailsExternalSent` / `emailsExternalReceived` ne comptent pas.** Un
 *   email parti hors de lemlist peut être **celui que le CRM vient d'envoyer**
 *   depuis la même boîte, déjà compté par le journal des envois. La règle du
 *   jalon 109 — les emails se comptent dans `email_sends` — l'emporte ;
 * - **un échec d'envoi n'est pas un rebond.** Seul `emailsBounced` devient
 *   `bounce`. `emailsFailed`, `linkedinSendFailed` et les douze autres `*Failed`
 *   disent que **notre** automatisation n'a pas abouti ; les ranger dans le
 *   rebond ferait mesurer au taux de rebond la santé de l'outil au lieu de la
 *   réception du message ;
 * - **`*Interested` / `*NotInterested` ne sont pas des réponses.** La personne
 *   a répondu (`emailsReplied`), **puis** quelqu'un l'a classée : deux
 *   activités pour un fait. Écrire la seconde comme une réponse doublerait le
 *   taux de réponse, et rétro-corriger la première casserait l'idempotence
 *   `(source, externalId)` qui rend les rejeux inoffensifs. La catégorie d'une
 *   réponse reste donc **non posée**, exactement comme pour une réponse
 *   relevée en IMAP (jalon 41) : le produit ne devine pas une catégorie.
 *
 * ## Les ouvertures entrent, et ne comptent pas
 *
 * `message_opened` et `link_clicked` sont importés — on veut pouvoir regarder
 * une campagne ligne à ligne — mais **aucun indicateur ne les sélectionne**.
 * Ce n'est pas une promesse, c'est une propriété de construction : chaque
 * chiffre de `lib/domain/pilotage.ts` énumère les types qu'il additionne, et
 * aucun n'énumère ceux-là. Le jalon 109 avait retiré les ouvertures des
 * indicateurs ; les réimporter ne les y remet pas.
 *
 * ## Rien n'est jeté en silence
 *
 * Tout type sans correspondance devient un événement de type `other` qui
 * **porte son nom lemlist dans `detail`**, et `/reglages` les liste. Un type
 * que lemlist ajouterait demain suit le même chemin : il apparaît à l'écran
 * sous son vrai nom, plutôt que de disparaître.
 */

import type { OutreachChannel, OutreachType } from "./outreach";

/* ------------------------------------------------- le vocabulaire source --- */

/**
 * L'énumération `ActivityType` publiée, recopiée **verbatim** et dans l'ordre
 * de la documentation.
 *
 * Elle n'est pas là pour valider une entrée — un type inconnu doit passer, pas
 * lever — mais pour que la table de correspondance soit **vérifiable** : un
 * test parcourt cette liste et échoue si l'une de ses valeurs n'a pas de
 * décision écrite.
 */
export const LEMLIST_ACTIVITY_TYPES = [
  "emailsSent",
  "emailsOpened",
  "emailsClicked",
  "emailsReplied",
  "emailsExternalSent",
  "emailsExternalReceived",
  "emailsDone",
  "emailsIgnored",
  "emailsBounced",
  "emailsFailed",
  "emailsUnsubscribed",
  "emailsInterested",
  "emailsNotInterested",
  "snoozed",
  "annotated",
  "aircallDone",
  "aircallIgnored",
  "aircallCreated",
  "aircallEnded",
  "aircallInterested",
  "aircallNotInterested",
  "apiDone",
  "apiIgnored",
  "apiInterested",
  "apiNotInterested",
  "apiFailed",
  "apiUnsubscribed",
  "enrichmentDone",
  "enrichmentFailed",
  "enrichmentSkipped",
  "linkedinVisitDone",
  "linkedinVisitFailed",
  "linkedinVisitSkipped",
  "linkedinCommentLastPostDone",
  "linkedinCommentLastPostFailed",
  "linkedinCommentLastPostSkipped",
  "linkedinFollowDone",
  "linkedinFollowFailed",
  "linkedinFollowSkipped",
  "linkedinLikeLastPostDone",
  "linkedinLikeLastPostNoPost",
  "linkedinLikeLastPostFailed",
  "linkedinLikeLastPostSkipped",
  "linkedinInviteDone",
  "linkedinEndorseDone",
  "linkedinEndorseFailed",
  "linkedinEndorseSkipped",
  "linkedinSent",
  "linkedinInMailSent",
  "linkedinOpened",
  "linkedinInviteAccepted",
  "linkedinInviteFailed",
  "linkedinSendFailed",
  "linkedinInMailFailed",
  "linkedinInMailSkipped",
  "linkedinVoiceNoteDone",
  "linkedinVoiceNoteFailed",
  "linkedinWithdrawInvitationDone",
  "linkedinWithdrawInvitationFailed",
  "linkedinVoiceNoteReplied",
  "whatsappMessageSent",
  "whatsappMessageDelivered",
  "whatsappMessageOpened",
  "whatsappReplied",
  "whatsappMessageFailed",
  "whatsappDone",
  "whatsappIgnored",
  "whatsappVoiceNoteSent",
  "whatsappVoiceNoteDelivered",
  "whatsappVoiceNoteOpened",
  "whatsappVoiceNoteReplied",
  "whatsappVoiceNoteFailed",
  "whatsappVoiceNoteIgnored",
  "smsSent",
  "smsDone",
  "smsDelivered",
  "smsReplied",
  "smsIgnored",
  "smsFailed",
  "aiVariableDone",
  "aiVariableFailed",
  "linkedinReplied",
  "linkedinInterested",
  "linkedinNotInterested",
  "linkedinDone",
  "linkedinIgnored",
  "manualDone",
  "manualIgnored",
  "manualInterested",
  "manualNotInterested",
  "manualUnsubscribed",
  "scheduleCancelled",
  "paused",
  "stopped",
  "resumed",
  "skipped",
  "meetingBooked",
  "conditionChosen",
  "conditionalFailed",
  "sendToAnotherCampaign",
  "manualEmailQueued",
  "manualLinkedinSendQueued",
  "manualLinkedinVoiceNoteQueued",
  "manualLinkedinInviteQueued",
  "manualLinkedinCommentLastPostQueued",
  "manualWhatsappMessageQueued",
  "manualWhatsappVoiceNoteQueued",
  "outOfOffice",
  "mailinblackDetected",
  "entityUnsubscribed",
  "variableUnsubscribed",
  "entitySubscribed",
  "variableSubscribed",
] as const;

/**
 * Les événements que `POST /api/hooks` sait servir **sans** être des types
 * d'activité.
 *
 * Les six premiers sont des **agrégats d'état de lead** : ils redisent, sous un
 * autre nom, une activité qui porte déjà son type (`contacted` double
 * `emailsSent`, `warmed` double `emailsReplied`…). Les suivants sont des
 * événements d'espace de travail ou d'enrichissement, qui ne concernent
 * personne en particulier.
 *
 * Tous tombent dans `other` : importés, nommés à l'écran, jamais comptés. Si
 * lemlist leur donne l'identifiant de l'activité sous-jacente, la contrainte
 * `(source, externalId)` les avale et il n'en reste rien — et si elle leur en
 * donne un propre, ils se posent en `other`, donc hors de tout indicateur.
 * **Lequel des deux se produit ne peut être établi qu'en production.**
 */
export const LEMLIST_WEBHOOK_ONLY_EVENTS = [
  "contacted",
  "hooked",
  "attracted",
  "warmed",
  "interested",
  "notInterested",
  "campaignComplete",
  "customDomainErrors",
  "connectionIssue",
  "sendLimitReached",
  "lemwarmPaused",
  "callRecordingDone",
  "callTranscriptDone",
  "inboxLabelUpdated",
  "signalRegistered",
  "deliverabilityAlertTriggered",
  "contactSourcingDone",
  "contactSourcingFailed",
  "enrichmentError",
] as const;

/* ------------------------------------------------- la correspondance ------- */

/** Ce qu'un type lemlist devient dans le journal. */
export interface LemlistMapping {
  readonly type: OutreachType;
  readonly channel: OutreachChannel;
  /** Recopié dans `detail` : de quoi relire la ligne six mois plus tard. */
  readonly detail: string;
}

/** Fabrique courte, pour que la table se lise comme un tableau. */
function m(type: OutreachType, channel: OutreachChannel, detail: string): LemlistMapping {
  return { type, channel, detail };
}

/** Le seau des types sans correspondance : importé, nommé, jamais compté. */
function keep(detail: string): LemlistMapping {
  return { type: "other", channel: "other", detail };
}

/**
 * **La table, une ligne par type documenté.**
 *
 * Aucune valeur n'est absente : un type sans correspondance y figure
 * explicitement avec sa raison, de sorte que le tableau se lise comme une
 * décision et non comme un oubli. Un test parcourt
 * `LEMLIST_ACTIVITY_TYPES` et `LEMLIST_WEBHOOK_ONLY_EVENTS` et échoue si une
 * valeur n'y est pas.
 */
export const LEMLIST_MAPPING: Readonly<Record<string, LemlistMapping>> = {
  /* --- envoyé : la définition lemlist de « sent », reprise telle quelle --- */
  emailsSent: m("message_sent", "email", "Email envoyé"),
  linkedinSent: m("message_sent", "linkedin_message", "Message LinkedIn envoyé"),
  linkedinInMailSent: m("message_sent", "linkedin_message", "InMail LinkedIn envoyé"),
  linkedinVoiceNoteDone: m("message_sent", "linkedin_message", "Note vocale LinkedIn envoyée"),
  whatsappMessageSent: m("message_sent", "whatsapp", "Message WhatsApp envoyé"),
  whatsappVoiceNoteSent: m("message_sent", "whatsapp", "Note vocale WhatsApp envoyée"),
  smsSent: m("message_sent", "other", "SMS envoyé"),
  aircallEnded: m("message_sent", "call", "Appel passé"),

  /* --- invitations LinkedIn : leurs deux types à elles ------------------- */
  linkedinInviteDone: m("linkedin_invite_sent", "linkedin_invite", "Invitation LinkedIn envoyée"),
  linkedinInviteAccepted: m(
    "linkedin_invite_accepted",
    "linkedin_invite",
    "Invitation LinkedIn acceptée",
  ),

  /* --- réponses : sans catégorie, jamais devinée ------------------------- */
  emailsReplied: m("reply_received", "email", "Réponse par email"),
  linkedinReplied: m("reply_received", "linkedin_message", "Réponse sur LinkedIn"),
  linkedinVoiceNoteReplied: m("reply_received", "linkedin_message", "Réponse à une note vocale"),
  whatsappReplied: m("reply_received", "whatsapp", "Réponse sur WhatsApp"),
  whatsappVoiceNoteReplied: m("reply_received", "whatsapp", "Réponse à une note vocale WhatsApp"),
  smsReplied: m("reply_received", "other", "Réponse par SMS"),

  /* --- rebond : le seul vrai ------------------------------------------- */
  emailsBounced: m("bounce", "email", "Email rejeté par le serveur du destinataire"),

  /* --- ouvertures et clics : importés, hors de tout indicateur ---------- */
  emailsOpened: m("message_opened", "email", "Email ouvert"),
  linkedinOpened: m("message_opened", "linkedin_message", "Message LinkedIn ouvert"),
  whatsappMessageOpened: m("message_opened", "whatsapp", "Message WhatsApp ouvert"),
  whatsappVoiceNoteOpened: m("message_opened", "whatsapp", "Note vocale WhatsApp ouverte"),
  emailsClicked: m("link_clicked", "email", "Lien cliqué dans un email"),

  /* --- désinscriptions -------------------------------------------------- */
  emailsUnsubscribed: m("unsubscribed", "email", "Désinscrit (email ou domaine sur la liste)"),
  apiUnsubscribed: m("unsubscribed", "other", "Désinscrit par l'API"),
  manualUnsubscribed: m("unsubscribed", "other", "Désinscrit à la main"),
  entityUnsubscribed: m("unsubscribed", "other", "Contact désinscrit de toute communication"),
  variableUnsubscribed: m("unsubscribed", "other", "Un moyen de contact désinscrit"),

  /* --- rendez-vous ------------------------------------------------------ */
  meetingBooked: m("meeting_booked", "other", "Rendez-vous obtenu dans lemlist"),

  /* --- sans correspondance : la raison est écrite ----------------------- */
  emailsExternalSent: keep("Email envoyé hors lemlist — déjà compté par le journal des envois"),
  emailsExternalReceived: keep("Email reçu hors lemlist"),
  emailsDone: keep("Tâche email achevée — l'envoi porte son propre type"),
  emailsIgnored: keep("Tâche email ignorée"),
  emailsFailed: keep("Échec d'envoi d'email — un échec n'est pas un rebond"),
  emailsInterested: keep("Marqué intéressé depuis un email — classement, pas réponse"),
  emailsNotInterested: keep("Marqué non intéressé depuis un email"),
  snoozed: keep("Reporté"),
  annotated: keep("Annotation sur le lead"),
  aircallDone: keep("Tâche d'appel achevée — l'appel porte aircallEnded"),
  aircallIgnored: keep("Tâche d'appel ignorée"),
  aircallCreated: keep("Appel créé, pas encore passé"),
  aircallInterested: keep("Marqué intéressé après un appel"),
  aircallNotInterested: keep("Marqué non intéressé après un appel"),
  apiDone: keep("Étape d'API exécutée"),
  apiIgnored: keep("Étape d'API ignorée"),
  apiInterested: keep("Marqué intéressé par l'API"),
  apiNotInterested: keep("Marqué non intéressé par l'API"),
  apiFailed: keep("Échec d'une étape d'API"),
  enrichmentDone: keep("Enrichissement terminé"),
  enrichmentFailed: keep("Échec d'enrichissement"),
  enrichmentSkipped: keep("Enrichissement sauté"),
  linkedinVisitDone: keep("Profil LinkedIn visité — une visite n'est pas un message"),
  linkedinVisitFailed: keep("Échec de visite de profil LinkedIn"),
  linkedinVisitSkipped: keep("Visite de profil LinkedIn sautée"),
  linkedinCommentLastPostDone: keep("Commentaire déposé sur le dernier post"),
  linkedinCommentLastPostFailed: keep("Échec de commentaire sur le dernier post"),
  linkedinCommentLastPostSkipped: keep("Commentaire sur le dernier post sauté"),
  linkedinFollowDone: keep("Profil LinkedIn suivi"),
  linkedinFollowFailed: keep("Échec de suivi de profil LinkedIn"),
  linkedinFollowSkipped: keep("Suivi de profil LinkedIn sauté"),
  linkedinLikeLastPostDone: keep("Dernier post aimé"),
  linkedinLikeLastPostNoPost: keep("Aucun post à aimer"),
  linkedinLikeLastPostFailed: keep("Échec de « aimer le dernier post »"),
  linkedinLikeLastPostSkipped: keep("« Aimer le dernier post » sauté"),
  linkedinEndorseDone: keep("Compétence recommandée sur LinkedIn"),
  linkedinEndorseFailed: keep("Échec de recommandation de compétence"),
  linkedinEndorseSkipped: keep("Recommandation de compétence sautée"),
  linkedinInviteFailed: keep("Échec d'envoi d'invitation LinkedIn"),
  linkedinSendFailed: keep("Échec d'envoi de message LinkedIn"),
  linkedinInMailFailed: keep("Échec d'envoi d'InMail"),
  linkedinInMailSkipped: keep("InMail sauté"),
  linkedinVoiceNoteFailed: keep("Échec d'envoi de note vocale LinkedIn"),
  linkedinWithdrawInvitationDone: keep("Invitation LinkedIn retirée"),
  linkedinWithdrawInvitationFailed: keep("Échec de retrait d'invitation LinkedIn"),
  linkedinInterested: keep("Marqué intéressé depuis LinkedIn — classement, pas réponse"),
  linkedinNotInterested: keep("Marqué non intéressé depuis LinkedIn"),
  linkedinDone: keep("Tâche LinkedIn achevée — l'envoi porte son propre type"),
  linkedinIgnored: keep("Tâche LinkedIn ignorée"),
  whatsappMessageDelivered: keep("Message WhatsApp remis — l'envoi est déjà compté"),
  whatsappMessageFailed: keep("Échec d'envoi WhatsApp"),
  whatsappDone: keep("Tâche WhatsApp achevée"),
  whatsappIgnored: keep("Tâche WhatsApp ignorée"),
  whatsappVoiceNoteDelivered: keep("Note vocale WhatsApp remise"),
  whatsappVoiceNoteFailed: keep("Échec d'envoi de note vocale WhatsApp"),
  whatsappVoiceNoteIgnored: keep("Note vocale WhatsApp ignorée"),
  smsDone: keep("Tâche SMS achevée"),
  smsDelivered: keep("SMS remis — l'envoi est déjà compté"),
  smsIgnored: keep("Tâche SMS ignorée"),
  smsFailed: keep("Échec d'envoi de SMS"),
  aiVariableDone: keep("Variable IA calculée"),
  aiVariableFailed: keep("Échec de calcul d'une variable IA"),
  manualDone: keep("Tâche manuelle achevée — le geste porte son propre type"),
  manualIgnored: keep("Tâche manuelle ignorée"),
  manualInterested: keep("Marqué intéressé à la main — classement, pas réponse"),
  manualNotInterested: keep("Marqué non intéressé à la main"),
  scheduleCancelled: keep("Planification annulée"),
  paused: keep("Lead mis en pause"),
  stopped: keep("Lead arrêté"),
  resumed: keep("Lead relancé"),
  skipped: keep("Étape sautée"),
  conditionChosen: keep("Branche de condition choisie"),
  conditionalFailed: keep("Échec d'évaluation d'une condition"),
  sendToAnotherCampaign: keep("Transféré vers une autre campagne"),
  manualEmailQueued: keep("Email manuel en file — rien n'est encore parti"),
  manualLinkedinSendQueued: keep("Message LinkedIn manuel en file"),
  manualLinkedinVoiceNoteQueued: keep("Note vocale LinkedIn manuelle en file"),
  manualLinkedinInviteQueued: keep("Invitation LinkedIn manuelle en file"),
  manualLinkedinCommentLastPostQueued: keep("Commentaire manuel en file"),
  manualWhatsappMessageQueued: keep("Message WhatsApp manuel en file"),
  manualWhatsappVoiceNoteQueued: keep("Note vocale WhatsApp manuelle en file"),
  outOfOffice: keep("Absence du bureau détectée — pas une réponse d'humain"),
  mailinblackDetected: keep("Filtre Mailinblack détecté"),
  entitySubscribed: keep("Contact réinscrit"),
  variableSubscribed: keep("Moyen de contact réinscrit"),

  /* --- les événements de webhook qui ne sont pas des activités ---------- */
  contacted: keep("État de lead agrégé : contacté"),
  hooked: keep("État de lead agrégé : a ouvert"),
  attracted: keep("État de lead agrégé : a cliqué ou accepté une invitation"),
  warmed: keep("État de lead agrégé : a répondu"),
  interested: keep("État de lead agrégé : intéressé"),
  notInterested: keep("État de lead agrégé : non intéressé"),
  campaignComplete: keep("Campagne terminée"),
  customDomainErrors: keep("Erreur de domaine personnalisé"),
  connectionIssue: keep("Problème de connexion d'une boîte d'envoi"),
  sendLimitReached: keep("Plafond d'envoi quotidien atteint"),
  lemwarmPaused: keep("lemwarm en pause"),
  callRecordingDone: keep("Enregistrement d'appel disponible"),
  callTranscriptDone: keep("Transcription d'appel disponible"),
  inboxLabelUpdated: keep("Étiquette de conversation modifiée"),
  signalRegistered: keep("Signal détecté par un agent de veille"),
  deliverabilityAlertTriggered: keep("Alerte de délivrabilité"),
  contactSourcingDone: keep("Recherche de contacts terminée"),
  contactSourcingFailed: keep("Échec de recherche de contacts"),
  enrichmentError: keep("Erreur d'enrichissement"),
};

/**
 * Les types qui produisent un indicateur. Sert la documentation et les tests ;
 * la mesure, elle, se fait dans `lib/domain/pilotage.ts`.
 */
export const MAPPED_LEMLIST_TYPES: readonly string[] = Object.keys(LEMLIST_MAPPING).filter(
  (key) => LEMLIST_MAPPING[key]?.type !== "other",
);

/**
 * La correspondance d'un type, **quel qu'il soit**.
 *
 * Un type absent de la table — lemlist en ajoutera — ne lève pas et n'est pas
 * jeté : il devient `other` en portant son nom brut, que `/reglages` affiche.
 */
export function mapLemlistType(raw: string): LemlistMapping {
  const known = LEMLIST_MAPPING[raw.trim()];
  if (known !== undefined) return known;
  return keep(`Type lemlist inconnu de cette version : ${raw.trim()}`);
}

/** Vrai si le type a une correspondance autre que le seau `other`. */
export function isMappedLemlistType(raw: string): boolean {
  return LEMLIST_MAPPING[raw.trim()]?.type !== undefined && LEMLIST_MAPPING[raw.trim()]?.type !== "other";
}

/* --------------------------------------------- la lecture d'une activité --- */

/**
 * Une activité lemlist, ramenée à ce dont la synchronisation a besoin.
 *
 * Toutes les chaînes sont **déjà nettoyées** : l'adresse en minuscules sans
 * espaces, l'URL LinkedIn réduite à sa forme comparable. Le rapprochement se
 * fait sur ces valeurs, et nulle part ailleurs.
 */
export interface LemlistActivity {
  /** `_id`, qui devient l'`externalId` de l'événement. */
  readonly externalId: string;
  readonly rawType: string;
  readonly occurredAt: Date;
  readonly email: string;
  readonly linkedinUrl: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly companyName: string;
  readonly companyDomain: string;
  readonly jobTitle: string;
  readonly phone: string;
  readonly campaignId: string;
  readonly campaignName: string;
  /** `sendUserName` — le nom lemlist de l'expéditeur, pas encore un propriétaire. */
  readonly sendUserName: string;
  readonly subject: string;
}

/** Lit une chaîne d'un objet non typé, sans jamais lever. */
function str(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === "string" ? value.trim() : "";
}

/** L'adresse, à la forme sur laquelle on rapproche : coupée, en minuscules. */
export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * L'URL LinkedIn réduite à ce qui identifie la personne.
 *
 * `https://www.linkedin.com/in/jean-dupont/` et `linkedin.com/in/jean-dupont`
 * désignent le même profil : sans cette réduction, le second rapprochement du
 * jalon — « puis par URL LinkedIn » — échouerait sur une barre oblique. Le
 * schéma, le `www.`, les paramètres et la barre finale partent ; la casse
 * tombe. **Rien n'est réécrit en base** : c'est une clé de comparaison, et la
 * valeur stockée reste celle que la source a donnée (règle du jalon 10).
 */
export function normaliseLinkedin(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "") return "";
  const withoutScheme = trimmed.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const withoutQuery = withoutScheme.split("?")[0] ?? "";
  return withoutQuery.replace(/\/+$/, "");
}

/**
 * Le domaine d'une société, déduit d'un domaine annoncé ou d'une adresse.
 *
 * Les domaines de messagerie publique sont **refusés** : rapprocher sur
 * `gmail.com` fusionnerait tous les indépendants du portefeuille dans une
 * société nommée Gmail. C'est le seul garde-fou qui compte ici.
 */
const PUBLIC_MAIL_DOMAINS: readonly string[] = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "outlook.fr",
  "hotmail.com",
  "hotmail.fr",
  "live.com",
  "live.fr",
  "msn.com",
  "yahoo.com",
  "yahoo.fr",
  "icloud.com",
  "me.com",
  "free.fr",
  "orange.fr",
  "wanadoo.fr",
  "sfr.fr",
  "laposte.net",
  "protonmail.com",
  "proton.me",
  "gmx.com",
  "aol.com",
];

export function companyDomainOf(declared: string, email: string): string {
  const fromDeclared = normaliseLinkedin(declared);
  const candidate =
    fromDeclared !== "" ? fromDeclared.split("/")[0] ?? "" : normaliseEmail(email).split("@")[1] ?? "";
  if (candidate === "") return "";
  if (PUBLIC_MAIL_DOMAINS.includes(candidate)) return "";
  return candidate;
}

/**
 * Lit une charge utile brute — webhook ou relevé, **même forme documentée** —
 * et rend `null` si elle ne porte pas de quoi écrire une ligne.
 *
 * Deux champs sont indispensables et un seul refus en découle : sans `_id`, la
 * déduplication n'a pas de clé ; sans `type`, il n'y a rien à mesurer. Une date
 * illisible retombe sur `null` elle aussi — poser un événement à la date du
 * jour parce que la source n'en donnait pas déplacerait un fait d'hier dans la
 * semaine en cours, et fausserait la mesure en silence.
 *
 * Tout le reste est facultatif, et c'est voulu : la documentation est explicite
 * sur le fait qu'une activité **hors campagne** ne porte aucune clé `lead*`.
 * Les deux formes — `leadEmail` / `email`, `leadFirstName` / `firstName`,
 * `lead.variables.*` — sont donc lues dans cet ordre de préférence.
 */
export function readLemlistActivity(raw: unknown): LemlistActivity | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;

  const externalId = str(source, "_id");
  const rawType = str(source, "type");
  if (externalId === "" || rawType === "") return null;

  const occurredAt = new Date(str(source, "createdAt"));
  if (Number.isNaN(occurredAt.getTime())) return null;

  const lead = source["lead"];
  const variables =
    typeof lead === "object" && lead !== null && !Array.isArray(lead)
      ? (lead as Record<string, unknown>)["variables"]
      : undefined;
  const vars: Record<string, unknown> =
    typeof variables === "object" && variables !== null && !Array.isArray(variables)
      ? (variables as Record<string, unknown>)
      : {};

  const pick = (...keys: readonly string[]): string => {
    for (const key of keys) {
      const direct = str(source, key);
      if (direct !== "") return direct;
      const fromVars = str(vars, key);
      if (fromVars !== "") return fromVars;
    }
    return "";
  };

  const email = normaliseEmail(pick("leadEmail", "email"));
  return {
    externalId,
    rawType,
    occurredAt,
    email,
    linkedinUrl: normaliseLinkedin(pick("linkedinUrl")),
    firstName: pick("leadFirstName", "firstName"),
    lastName: pick("leadLastName", "lastName"),
    companyName: pick("leadCompanyName", "companyName"),
    companyDomain: companyDomainOf(pick("companyDomain"), email),
    jobTitle: pick("jobTitle"),
    phone: pick("leadPhone", "phone"),
    campaignId: pick("campaignId"),
    campaignName: pick("campaignName"),
    sendUserName: pick("sendUserName", "userName"),
    subject: pick("subject"),
  };
}

/**
 * Le propriétaire d'un événement, dans le vocabulaire du CRM.
 *
 * lemlist rend « YANIS TIDAHY » ; le CRM assigne « Yanis ». Rapprocher sur le
 * **prénom**, sans casse ni accents, contre la liste des propriétaires déjà
 * configurée est la seule façon de ne pas introduire un second vocabulaire.
 * Sans correspondance, le champ reste vide : un propriétaire inventé
 * apparaîtrait dans le filtre « par personne » de `/pilotage` comme une
 * troisième personne qui n'existe pas.
 */
export function ownerFromLemlist(sendUserName: string, owners: readonly string[]): string {
  const fold = (value: string): string =>
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  const words = fold(sendUserName).split(/\s+/).filter((word) => word !== "");
  for (const owner of owners) {
    const target = fold(owner);
    if (target !== "" && words.includes(target)) return owner;
  }
  return "";
}

/* ------------------------------------- « actif dans une campagne lemlist » - */

/**
 * Ce qu'il faut savoir d'un contact pour dire s'il est en cours de prospection
 * dans lemlist. Volontairement réduit à des faits du journal : la question se
 * répond sur ce qu'on a importé, sans second appel à l'API.
 */
export interface LemlistTouch {
  readonly type: OutreachType;
  readonly occurredAt: Date;
  readonly campaignName: string;
}

/**
 * Le délai au-delà duquel une campagne lemlist n'est plus « en cours ».
 *
 * Trente jours : une séquence lemlist tient quelques semaines, et un contact
 * touché il y a deux mois sans suite n'est plus activement travaillé. Le refus
 * d'inscription doit protéger de la double sollicitation, pas geler le
 * portefeuille pour toujours.
 */
export const LEMLIST_ACTIVE_DAYS = 30;

/**
 * **La campagne lemlist qui travaille encore ce contact, ou `null`.**
 *
 * La règle, dans l'ordre où elle se lit : on regarde le dernier fait lemlist du
 * contact ; si c'est une réponse, une désinscription ou un rebond, lemlist a
 * fini avec lui — la séquence s'arrête d'elle-même sur ces trois faits. Si
 * c'est un envoi ou une invitation et qu'il est récent, la campagne est en
 * cours et on la nomme.
 *
 * Déduire l'état d'une campagne du journal plutôt que d'interroger lemlist est
 * un choix assumé : le refus d'inscription doit répondre **sans réseau**, parce
 * qu'une clé absente ou une API lente ne doit pas empêcher d'inscrire
 * quelqu'un, ni le permettre par accident.
 */
export function activeLemlistCampaign(
  touches: readonly LemlistTouch[],
  now: Date,
): string | null {
  const sorted = [...touches].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  const last = sorted[0];
  if (last === undefined) return null;

  const STOPS: readonly OutreachType[] = ["reply_received", "unsubscribed", "bounce"];
  if (STOPS.includes(last.type)) return null;

  const SENDS: readonly OutreachType[] = ["message_sent", "linkedin_invite_sent"];
  const lastSend = sorted.find((touch) => SENDS.includes(touch.type));
  if (lastSend === undefined) return null;

  const days = (now.getTime() - lastSend.occurredAt.getTime()) / 86_400_000;
  if (days > LEMLIST_ACTIVE_DAYS) return null;
  return lastSend.campaignName === "" ? "une campagne lemlist" : lastSend.campaignName;
}

/* ------------------------------------------------------- l'état affiché ---- */

/** Les quatre états possibles de la connexion, vocabulaire fermé. */
export const LEMLIST_STATUSES = ["connected", "missing_key", "refused", "unknown"] as const;
export type LemlistStatusKey = (typeof LEMLIST_STATUSES)[number];

/**
 * Les libellés affichés, **à un seul endroit**.
 *
 * Le panneau est un composant client, le lecteur d'état est `server-only` :
 * sans cette table dans le domaine, chacun aurait recopié ses libellés, et
 * l'écran aurait fini par dire autre chose que la réponse de l'API. C'est
 * exactement l'écart que `resolveStatus` ferme depuis le jalon 13.
 */
export const LEMLIST_STATUS_LABELS: Readonly<Record<string, string>> = {
  connected: "connecté",
  missing_key: "clé absente",
  refused: "clé refusée par lemlist",
  unknown: "jamais synchronisé",
};

/** La phrase qui dit quoi faire quand la clé manque, écrite une fois. */
export const MISSING_KEY_MESSAGE =
  "Clé absente : posez LEMLIST_API_KEY dans les variables du service.";
