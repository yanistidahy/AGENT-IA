import { z } from "zod";
import { prisma } from "../db";

/**
 * Sauvegarde et restauration complètes, en JSON.
 *
 * Ce module existe pour la raison qui a motivé le correctif du seed : une base
 * peut se vider. Un export téléchargeable et une restauration qui remet tout en
 * place valent mieux qu'un espoir sur la persistance du volume.
 *
 * La restauration **remplace** l'intégralité des données. Elle passe donc dans
 * une transaction : si une seule ligne est refusée, rien n'est supprimé. C'est
 * exactement l'erreur qui a coûté une base de production.
 */

export const BACKUP_VERSION = 1;

export async function exportBackup(): Promise<Record<string, unknown>> {
  const [
    stages,
    companies,
    contacts,
    deals,
    activities,
    tasks,
    settings,
    settingsLists,
    sequences,
    sequenceSteps,
    roleAngles,
    roleAngleLabels,
    mailboxes,
    customFilters,
    customFilterMembers,
    taskTabs,
    outreachEvents,
    campaigns,
    emailSequences,
    emailSequenceSteps,
    emailStepVariants,
    enrollments,
    departures,
    emailSends,
    emailReplies,
    emailOpenHits,
    emailLinkClicks,
    signatories,
    domainRejections,
    dealStageVisits,
    agents,
  ] = await Promise.all([
    prisma.stage.findMany({ orderBy: { position: "asc" } }),
    prisma.company.findMany(),
    prisma.contact.findMany(),
    prisma.deal.findMany(),
    prisma.activity.findMany(),
    prisma.task.findMany(),
    prisma.settings.findUnique({ where: { id: "singleton" } }),
    prisma.settingsList.findMany(),
    prisma.sequence.findMany(),
    prisma.sequenceStep.findMany(),
    prisma.roleAngle.findMany({ orderBy: { position: "asc" } }),
    prisma.roleAngleLabel.findMany(),
    prisma.mailbox.findMany({ orderBy: { position: "asc" } }),
    prisma.customFilter.findMany(),
    prisma.customFilterMember.findMany(),
    prisma.taskTab.findMany(),
    prisma.outreachEvent.findMany({ orderBy: { occurredAt: "asc" } }),
    // **L'histoire de prospection** (jalon 110) : sans elle, une restauration
    // rendait les contacts et laissait leurs envois orphelins.
    prisma.campaign.findMany(),
    prisma.emailSequence.findMany(),
    prisma.emailSequenceStep.findMany({ orderBy: { position: "asc" } }),
    prisma.emailStepVariant.findMany(),
    prisma.sequenceEnrollment.findMany(),
    prisma.sequenceDeparture.findMany(),
    prisma.emailSend.findMany({ orderBy: { sentAt: "asc" } }),
    prisma.emailReply.findMany(),
    prisma.emailOpenHit.findMany(),
    prisma.emailLinkClick.findMany(),
    prisma.signatory.findMany({ orderBy: { position: "asc" } }),
    prisma.domainRejection.findMany(),
    prisma.dealStageVisit.findMany(),
    prisma.agent.findMany({ orderBy: { order: "asc" } }),
  ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    stages,
    companies,
    contacts,
    deals,
    activities,
    tasks,
    settings,
    settingsLists,
    sequences,
    sequenceSteps,
    roleAngles,
    roleAngleLabels,
    mailboxes,
    customFilters,
    customFilterMembers,
    taskTabs,
    outreachEvents,
    campaigns,
    emailSequences,
    emailSequenceSteps,
    emailStepVariants,
    enrollments,
    departures,
    emailSends,
    emailReplies,
    emailOpenHits,
    emailLinkClicks,
    signatories,
    domainRejections,
    dealStageVisits,
    agents,
  };
}

/**
 * Formes attendues à la restauration.
 *
 * **Toute colonne absente d'ici est effacée par une restauration.** Zod retire
 * les clés qu'il ne connaît pas, et les deux chemins réels — la route et le
 * planificateur — valident *avant* d'appeler `restoreBackup()`. Une colonne
 * oubliée traverse donc l'export intacte, disparaît à la validation, et la
 * ligne est recréée avec la valeur par défaut du schéma Prisma. En silence.
 *
 * C'est ce qui s'est produit en production au jalon 42 : la configuration SMTP
 * et IMAP, les statuts saisis, les motifs de perte, les étiquettes, les miroirs
 * de recherche et **les issues d'interaction** ont été remis à zéro par une
 * restauration, sans un mot. `tests/backup-columns.test.ts` interdit la
 * rechute — il échoue si une colonne du schéma Prisma manque ici.
 *
 * Les colonnes ajoutées après coup sont **optionnelles** : une sauvegarde plus
 * ancienne ne peut pas porter ce qui n'existait pas quand elle a été prise, et
 * la refuser rendrait tout le filet inutile au moment où l'on en a besoin.
 *
 * Elles sont explicites plutôt que permissives pour deux raisons : le typage de
 * `createMany` l'exige, et surtout **JSON n'a pas de type date**. Un export
 * relu tel quel passerait des chaînes ISO là où Prisma attend des `Date`, et la
 * restauration échouerait — ou pire, écrirait des dates fausses. `z.coerce.date()`
 * fait la conversion à la frontière, au même endroit que le reste du projet.
 */
const day = z.coerce.date();
const optionalDay = z.coerce.date().nullable().optional();
const text = z.string();
const optionalText = z.string().optional();

const stageRow = z.object({
  id: z.string(),
  name: text,
  color: text,
  prob: z.number().int(),
  position: z.number().int(),
  // Optionnels : une sauvegarde antérieure à l'automatisation reste restaurable.
  nextActionLabel: optionalText,
  nextActionDays: z.number().int().optional(),
  /** Critère de sortie du jalon 22. */
  exitCriterion: optionalText,
});

const companyRow = z.object({
  id: z.string(),
  name: text,
  domain: optionalText,
  size: optionalText,
  industry: optionalText,
  loc: optionalText,
  desc: optionalText,
  createdAt: day,
  /** Miroir de recherche : sans lui, la société devient introuvable. */
  searchText: optionalText,
  /**
   * Clé de tri : sans elle, la société revient d'une restauration **en fin de
   * liste alphabétique**, ce qui ne ressemble pas à une perte de données et en
   * est une. Facultative, comme les autres ajouts : une sauvegarde plus
   * ancienne ne peut pas porter une colonne qui n'existait pas.
   */
  nameKey: optionalText,
  /** Le segment du pilotage se lit ici : l'effacer viderait les deux tableaux. */
  monthlyVisitors: z.number().int().nullable().optional(),
});

const contactRow = z.object({
  id: z.string(),
  firstName: text,
  lastName: text,
  title: optionalText,
  dep: optionalText,
  email: optionalText,
  phone: optionalText,
  linkedin: optionalText,
  /** La note écrite pour Alex : perdue, il réécrit à l'aveugle. */
  alexNote: optionalText,
  lifecycle: text,
  source: optionalText,
  owner: optionalText,
  notes: optionalText,
  createdAt: day,
  lastContact: optionalDay,
  nextReminder: optionalDay,
  companyId: z.string().nullable().optional(),
  /* Ajoutées après le jalon 5, et perdues à chaque restauration jusqu'au 42. */
  tag: optionalText,
  /** Motif de perte — porte aussi l'opposition ferme au démarchage. */
  lostReason: optionalText,
  /** Statut saisi à la main (jalon 13) : il l'emporte sur le calcul. */
  status: optionalText,
  statusSetAt: optionalDay,
  website: optionalText,
  instagram: optionalText,
  searchText: optionalText,
  /** Clé de tri — voir companyRow.nameKey. */
  nameKey: optionalText,
  /**
   * Le groupe de fonction et sa provenance. `groupSetBy` porte les corrections
   * faites à la main : les perdre à une restauration rendrait au recalcul le
   * droit d'écraser un choix humain, en silence.
   */
  contactGroup: optionalText,
  groupSetBy: optionalText,
  emailCount: z.number().int().optional(),
  lastEmailAt: optionalDay,
});

const dealRow = z.object({
  id: z.string(),
  name: text,
  amount: z.number().int(),
  owner: text,
  offer: optionalText,
  status: text,
  prob: z.number().int().nullable().optional(),
  notes: optionalText,
  // Facultatif comme les autres ajouts : une sauvegarde antérieure au jalon 47
  // ne peut pas porter ce que la colonne n'avait pas encore, et la refuser
  // rendrait le filet inutile au moment précis où l'on en a besoin.
  lostReason: optionalText,
  createdAt: day,
  expectedClose: optionalDay,
  lastActivityAt: optionalDay,
  stageSince: optionalDay,
  closedAt: optionalDay,
  stageId: z.string(),
  companyId: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(),
  searchText: optionalText,
});

const activityRow = z.object({
  id: z.string(),
  type: text,
  date: day,
  owner: text,
  notes: optionalText,
  duration: z.number().int().nullable().optional(),
  createdAt: day,
  contactId: z.string().nullable().optional(),
  dealId: z.string().nullable().optional(),
  companyId: z.string().nullable().optional(),
  /**
   * **L'issue de l'échange.** Sans elle, une restauration efface la mémoire de
   * qui a répondu : le taux de réponse, l'entonnoir des emails et la détection
   * de réponse retombent tous à zéro alors que les interactions sont là.
   */
  outcome: optionalText,
});

const taskRow = z.object({
  id: z.string(),
  title: text,
  due: day,
  priority: text,
  owner: text,
  /**
   * Le canal de la tâche (jalon 105). **Optionnel** : une sauvegarde prise
   * avant ce jalon n'en porte pas, et la refuser rendrait le filet inutile au
   * moment précis où l'on en a besoin (jalon 42).
   */
  kind: text.optional(),
  done: z.boolean(),
  auto: z.boolean().optional(),
  autoKey: z.string().nullable().optional(),
  doneAt: optionalDay,
  createdAt: day,
  contactId: z.string().nullable().optional(),
  companyId: z.string().nullable().optional(),
  dealId: z.string().nullable().optional(),
});

/**
 * La ligne de réglages, **en entier**.
 *
 * C'est la table qui a le plus grandi depuis le jalon 5 — onze colonnes alors,
 * quarante-quatre aujourd'hui — et c'est elle qui a coûté le plus cher : la
 * configuration SMTP et IMAP y vit, donc une restauration coupait l'envoi et
 * le relevé des réponses d'un seul coup, sans rien afficher.
 */
const settingsRow = z.object({
  id: z.string(),
  colleagueWarningDays: z.number().int().optional(),
  staleDays: z.number().int(),
  coldDays: z.number().int(),
  objectifMensuel: z.number().int(),
  relanceApresAppel: z.number().int().optional(),
  relanceApresEmail: z.number().int().optional(),
  relanceApresDemo: z.number().int().optional(),
  relanceApresReunion: z.number().int().optional(),
  relanceApresLinkedin: z.number().int().optional(),
  relanceApresInstagram: z.number().int().optional(),
  relanceApresNote: z.number().int().optional(),
  notifs: z.boolean(),
  updatedAt: day,

  /* — objectifs hebdomadaires (jalon 40) — */
  objectifAppelsSemaine: z.number().int().optional(),
  cibleMessagesSemaine: z.number().int().optional(),
  cibleDemosSemaine: z.number().int().optional(),
  cibleQualifieesSemaine: z.number().int().optional(),
  objectifEmailsSemaine: z.number().int().optional(),

  /* — messagerie : envoi (jalons 32 à 35) — */
  smtpHost: optionalText,
  smtpPort: z.number().int().optional(),
  smtpEncryption: optionalText,
  smtpUser: optionalText,
  smtpFrom: optionalText,
  smtpFromName: optionalText,
  signName: optionalText,
  signTitle: optionalText,
  demoLabel: optionalText,
  demoUrl: optionalText,
  ourSiteUrl: optionalText,
  videoDisplay: optionalText,

  /* — messagerie : copie « Envoyés », suivi, plafonds (jalons 37 et 38) — */
  imapHost: optionalText,
  imapPort: z.number().int().optional(),
  imapEncryption: optionalText,
  imapSentMailbox: optionalText,
  imapCopyEnabled: z.boolean().optional(),
  trackOpens: z.boolean().optional(),
  openRetentionMonths: z.number().int().optional(),
  sendPerHour: z.number().int().optional(),
  dailyMailboxCap: z.number().int().optional(),
  sendPerDay: z.number().int().optional(),
  sendLimitNotice: optionalText,
  sendLimitNoticeAt: optionalDay,

  /* — relevé de la boîte de réception (jalon 41) — */
  inboxPollEnabled: z.boolean().optional(),
  lastInboxPollAt: optionalDay,

  /* — conseil et coûts (jalons 14, 36) — */
  shiftTokenBudget: z.number().int().optional(),
  modelDraft: optionalText,
  modelRevision: optionalText,
  modelChat: optionalText,
  modelShift: optionalText,
  monthlyBudgetCents: z.number().int().optional(),
  lastCronAt: optionalDay,
});

const settingsListRow = z.object({
  id: z.string(),
  kind: text,
  value: text,
  position: z.number().int(),
});

const sequenceRow = z.object({
  id: z.string(),
  name: text,
  trigger: text,
  active: z.boolean(),
});

const sequenceStepRow = z.object({
  id: z.string(),
  day: z.number().int(),
  channel: text,
  label: text,
  position: z.number().int(),
  sequenceId: z.string(),
});

/**
 * Un rôle destinataire et sa note d'angle.
 *
 * Sauvegardés parce qu'ils sont **écrits à la main** : une note d'angle est du
 * travail de réflexion, pas une donnée dérivée. La perdre à une restauration
 * serait exactement l'incident du jalon 42 — la configuration SMTP effacée en
 * silence par un schéma de sauvegarde trop court.
 */
const roleAngleRow = z.object({
  id: z.string(),
  name: text,
  angle: optionalText,
  position: z.number().int(),
  createdAt: day,
});

const roleAngleLabelRow = z.object({
  id: z.string(),
  label: text,
  normalized: text,
  roleId: z.string(),
});

/**
 * Une boîte d'envoi — configuration écrite à la main, donc sauvegardée.
 *
 * **Jamais de mot de passe** : il vit dans l'environnement, pas en base, et
 * n'apparaît donc ni ici ni dans le JSON exporté (jalon 32).
 */
const mailboxRow = z.object({
  id: z.string(),
  slug: text,
  label: text,
  position: z.number().int(),
  active: z.boolean(),
  smtpHost: optionalText,
  smtpPort: z.number().int(),
  smtpEncryption: text,
  smtpUser: optionalText,
  smtpFrom: optionalText,
  smtpFromName: optionalText,
  imapHost: optionalText,
  imapPort: z.number().int(),
  imapEncryption: text,
  imapSentMailbox: optionalText,
  imapCopyEnabled: z.boolean(),
  signName: optionalText,
  signTitle: optionalText,
  signPhone: optionalText,
  createdAt: day,
});

/**
 * Une liste de contacts, et ses appartenances (jalon 77).
 *
 * **Sauvegardées, contrairement à la recherche ou au logo.** Ces deux-là sont
 * dérivés : ils se relisent et se retéléversent. Une liste, non — c'est un
 * choix fait à la main, que rien ne sait reconstituer. La perdre à une
 * restauration serait exactement l'incident du jalon 42, sur la donnée la plus
 * chère du produit : celle qu'aucune requête ne retrouve.
 */
const customFilterRow = z.object({
  id: z.string(),
  name: text,
  nameKey: z.string().nullable().optional(),
  createdAt: day,
});

/**
 * Un onglet personnalisé de l'écran Tâches (jalon 92).
 *
 * Sauvegardé pour la raison des filtres personnalisés : c'est une requête que
 * quelqu'un a composée puis nommée, et **rien ne sait la reconstituer**.
 */
const taskTabRow = z.object({
  id: z.string(),
  name: text,
  nameKey: z.string().nullable().optional(),
  query: z.string(),
  createdAt: day,
});

/**
 * Le journal d'événements : **la mesure du produit, et rien ne la reconstitue**.
 *
 * Les faits sources — envois, réponses, interactions — sont sauvegardés eux
 * aussi, donc une reprise pourrait en réécrire une partie. Mais pas tout : une
 * démo envoyée, testée, un retour reçu sont saisis à la main et n'ont aucune
 * autre trace. Les perdre à une restauration serait l'incident du jalon 42 sur
 * la donnée la plus chère de ce jalon.
 */
const outreachEventRow = z.object({
  id: z.string(),
  contactId: z.string(),
  companyId: z.string().nullable().optional(),
  campaignId: z.string().nullable().optional(),
  channel: z.string(),
  type: z.string(),
  occurredAt: day,
  owner: optionalText,
  source: optionalText,
  externalId: z.string().nullable().optional(),
  replyCategory: optionalText,
  detail: optionalText,
  createdAt: day,
});

/* ------------------------------------------------- l'histoire de prospection --
 *
 * **Tout ce qui suit a été ajouté au jalon 110, et pour une seule raison.**
 *
 * `email_sends` n'était pas sauvegardé, mais la restauration supprime et
 * recrée tous les contacts. `EmailSend.contactId` étant en `SetNull`, chaque
 * envoi perdait sa personne au moment du `deleteMany`, et rien ne la lui
 * rendait : la table n'était pas dans le fichier. Mesuré au jalon 109 — une
 * reprise lancée après une restauration ne retrouvait plus que 11 des 33
 * événements, les envois n'ayant plus personne à qui être attribués.
 *
 * La cause n'était donc **pas** une régénération d'identifiants : les contacts
 * reviennent avec les leurs (`createMany` porte `id`). C'était un trou de
 * couverture, et on le bouche en couvrant — pas en rattrapant relation par
 * relation.
 */

/** Une campagne. Sa boîte est restaurée avant elle : la clé étrangère l'exige. */
const campaignRow = z.object({
  id: z.string(),
  name: text,
  mailboxId: z.string(),
  selection: optionalText,
  mode: optionalText,
  groupFilter: optionalText,
  otherRouting: optionalText,
  nameKey: z.string().nullable().optional(),
  createdAt: day,
  archivedAt: optionalDay,
});

const emailSequenceRow = z.object({
  id: z.string(),
  name: text,
  active: z.boolean(),
  createdAt: day,
  autoMode: z.boolean().optional(),
  campaignId: z.string().nullable().optional(),
});

/**
 * Une étape d'email, avec **son texte**.
 *
 * C'est la donnée la plus chère de l'écran des campagnes : un objet et un corps
 * écrits à la main, relus, corrigés. Rien ne sait les reconstituer.
 */
const emailSequenceStepRow = z.object({
  id: z.string(),
  sequenceId: z.string(),
  position: z.number().int(),
  delayDays: z.number().int().optional(),
  brief: optionalText,
  mode: optionalText,
  subject: optionalText,
  body: optionalText,
  subjectMode: optionalText,
});

const emailStepVariantRow = z.object({
  id: z.string(),
  stepId: z.string(),
  group: z.string(),
  subject: optionalText,
  body: optionalText,
});

/** Qui est inscrit à quelle campagne, et où il en est. */
const enrollmentRow = z.object({
  id: z.string(),
  sequenceId: z.string(),
  contactId: z.string(),
  enrolledAt: day,
  status: optionalText,
  stopReason: optionalText,
  lastStep: z.number().int().optional(),
  lastSentAt: optionalDay,
  round: z.number().int().optional(),
  resetAt: optionalDay,
});

/**
 * Un départ composé et pas encore parti.
 *
 * Il porte un texte produit par un appel au modèle — donc payé. Le perdre
 * coûte de l'argent et une matinée de relecture, et c'est le seul endroit du
 * produit où l'on peut encore corriger avant l'envoi.
 */
const departureRow = z.object({
  id: z.string(),
  enrollmentId: z.string(),
  step: z.number().int(),
  createdAt: day,
  day: z.string(),
  status: optionalText,
  subject: optionalText,
  body: optionalText,
  auto: z.boolean().optional(),
  decidedAt: optionalDay,
  detail: optionalText,
  editedAt: optionalDay,
  round: z.number().int().optional(),
  templateHash: optionalText,
});

/**
 * Le journal des envois — **la table dont l'absence a motivé ce jalon**.
 *
 * `contactId` est nullable et le reste : un envoi orphelin est un fait du
 * produit depuis le jalon 39 (la fiche a été supprimée, le message est bien
 * parti). La restauration ne le invente donc pas ; elle rend simplement à
 * chaque envoi la personne qu'il avait.
 */
const emailSendRow = z.object({
  id: z.string(),
  sentAt: day,
  mailboxId: optionalText,
  contactId: z.string().nullable().optional(),
  toAddress: text,
  subject: text,
  body: optionalText,
  messageId: optionalText,
  signatoryId: optionalText,
  signatoryName: optionalText,
  tracked: z.boolean().optional(),
  trackToken: z.string().nullable().optional(),
  firstOpenAt: optionalDay,
  lastOpenAt: optionalDay,
  openCount: z.number().int().optional(),
  openNoise: z.number().int().optional(),
  purgedAt: optionalDay,
  sequenceId: optionalText,
  sequenceName: optionalText,
  sequenceStep: z.number().int().nullable().optional(),
  campaignId: optionalText,
  campaignName: optionalText,
  copyStatus: optionalText,
  copyError: optionalText,
});

const emailReplyRow = z.object({
  id: z.string(),
  replyMessageId: text,
  sentMessageId: text,
  emailSendId: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(),
  receivedAt: day,
  detectedAt: day,
  activityId: z.string().nullable().optional(),
});

/**
 * Les chargements du pixel et les clics.
 *
 * Ils ne sont plus un indicateur depuis le jalon 109, et ils sont sauvegardés
 * quand même : ce sont des **faits**, ils tiennent par cascade à un envoi qui,
 * lui, est désormais supprimé puis recréé à la restauration. Les laisser dehors
 * aurait créé une perte là où il n'y en avait pas.
 */
const emailOpenHitRow = z.object({
  id: z.string(),
  emailSendId: z.string(),
  at: day,
  delaySeconds: z.number().int().optional(),
  kind: optionalText,
});

const emailLinkClickRow = z.object({
  id: z.string(),
  emailSendId: z.string(),
  kind: z.string(),
  at: day,
});

const signatoryRow = z.object({
  id: z.string(),
  name: text,
  title: optionalText,
  isDefault: z.boolean().optional(),
  position: z.number().int().optional(),
});

/** Un domaine proposé puis refusé : sans lui, la recherche le reproposerait. */
const domainRejectionRow = z.object({
  id: z.string(),
  companyId: z.string(),
  proposed: text,
  rejectedAt: day,
});

const dealStageVisitRow = z.object({
  id: z.string(),
  dealId: z.string(),
  stageId: z.string(),
  enteredAt: day,
});

/**
 * Les agents, **sans leur portrait**.
 *
 * Nom, rôle affiché, ordre, cadence, activation : ce que quelqu'un a réglé.
 * Les photos sont des binaires et restent hors de la sauvegarde, comme le logo
 * et la vidéo ; un agent sans photo reprend ses initiales, ce qui est un état
 * normal du produit et non une panne.
 */
const agentRow = z.object({
  slug: z.string(),
  name: text,
  role: optionalText,
  enabled: z.boolean().optional(),
  order: z.number().int().optional(),
  shiftCadence: optionalText,
  createdAt: day,
  updatedAt: day,
});

const customFilterMemberRow = z.object({
  id: z.string(),
  filterId: z.string(),
  contactId: z.string(),
  addedAt: day,
});

export const backupSchema = z.object({
  version: z.number().int(),
  stages: z.array(stageRow),
  companies: z.array(companyRow),
  contacts: z.array(contactRow),
  deals: z.array(dealRow),
  activities: z.array(activityRow),
  tasks: z.array(taskRow),
  settings: settingsRow.nullable().optional(),
  settingsLists: z.array(settingsListRow),
  sequences: z.array(sequenceRow),
  sequenceSteps: z.array(sequenceStepRow),
  /** Optionnels : une sauvegarde antérieure au jalon 53 n'en porte pas, et la
   *  refuser rendrait le filet inutile au moment précis où l'on en a besoin. */
  roleAngles: z.array(roleAngleRow).optional(),
  roleAngleLabels: z.array(roleAngleLabelRow).optional(),
  mailboxes: z.array(mailboxRow).optional(),
  customFilters: z.array(customFilterRow).optional(),
  customFilterMembers: z.array(customFilterMemberRow).optional(),
  taskTabs: z.array(taskTabRow).optional(),
  outreachEvents: z.array(outreachEventRow).optional(),
  /** L'histoire de prospection, ajoutée au jalon 110 — optionnelle comme le
   *  reste : une sauvegarde d'avant ce jalon doit rester restaurable, et elle
   *  laisse alors ces tables **intactes** plutôt que de les vider. */
  campaigns: z.array(campaignRow).optional(),
  emailSequences: z.array(emailSequenceRow).optional(),
  emailSequenceSteps: z.array(emailSequenceStepRow).optional(),
  emailStepVariants: z.array(emailStepVariantRow).optional(),
  enrollments: z.array(enrollmentRow).optional(),
  departures: z.array(departureRow).optional(),
  emailSends: z.array(emailSendRow).optional(),
  emailReplies: z.array(emailReplyRow).optional(),
  emailOpenHits: z.array(emailOpenHitRow).optional(),
  emailLinkClicks: z.array(emailLinkClickRow).optional(),
  signatories: z.array(signatoryRow).optional(),
  domainRejections: z.array(domainRejectionRow).optional(),
  dealStageVisits: z.array(dealStageVisitRow).optional(),
  agents: z.array(agentRow).optional(),
});

export type BackupPayload = z.infer<typeof backupSchema>;

export type RestoreResult =
  | {
      readonly ok: true;
      readonly counts: Record<string, number>;
      /**
       * Les lignes que la restauration **n'a pas pu replacer**, par nature.
       *
       * Une inscription dont la fiche ne figure plus dans la sauvegarde ne peut
       * pas être recréée : la clé étrangère l'interdit, et l'inventer serait
       * pire. Avant le jalon 110 ces lignes étaient écartées **en silence** ;
       * elles se comptent désormais, et l'écran les dit.
       */
      readonly skipped: Record<string, number>;
      /** Ce que ce fichier-là ne savait pas porter. */
      readonly warnings: readonly string[];
    }
  | { readonly ok: false; readonly message: string };

/**
 * Garde les lignes dont la clé étrangère obligatoire existe, et **compte les
 * autres**. Une ligne écartée est une perte : elle se dit.
 */
function placeable<T>(
  rows: readonly T[],
  ok: (row: T) => boolean,
  label: string,
  skipped: Record<string, number>,
): T[] {
  const kept = rows.filter(ok);
  const lost = rows.length - kept.length;
  if (lost > 0) skipped[label] = (skipped[label] ?? 0) + lost;
  return kept;
}

export async function restoreBackup(payload: BackupPayload): Promise<RestoreResult> {
  if (payload.version !== BACKUP_VERSION) {
    return {
      ok: false,
      message: `Sauvegarde en version ${payload.version}, cette application attend la version ${BACKUP_VERSION}.`,
    };
  }

  const skipped: Record<string, number> = {};
  const warnings: string[] = [];
  /*
    **Un fichier d'avant le jalon 110 ne porte pas l'histoire de prospection.**
    Il reste restaurable — c'est la règle — mais il faut le dire : les contacts
    seront recréés, et les envois qui les citaient resteront orphelins, faute
    d'être dans le fichier. Se taire ici reproduirait le défaut à l'identique.
  */
  if (payload.emailSends === undefined) {
    warnings.push(
      "Ce fichier est antérieur au jalon 110 : il ne porte ni le journal des envois, " +
        "ni les campagnes, ni les inscriptions. Les envois survivront mais perdront " +
        "leur contact, et les inscriptions et départs seront supprimés avec les fiches. " +
        "C'est le comportement d'avant ce jalon ; prenez une sauvegarde récente si vous " +
        "le pouvez.",
    );
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        /*
          **L'histoire de prospection se supprime d'abord, enfants en tête.**

          Elle tient aux contacts : une inscription est supprimée en cascade
          avec sa fiche, un envoi perd la sienne par `SetNull`. La nettoyer
          avant de toucher aux contacts évite que la cascade décide à notre
          place — et c'est précisément ce qui avait orphelin les envois jusqu'au
          jalon 110.

          Chaque suppression reste conditionnée à la **présence de la section**
          dans le fichier : une sauvegarde plus ancienne, qui ne porte pas ces
          tables, ne doit pas les vider. C'est la règle posée au jalon 53, et
          elle vaut ici plus qu'ailleurs : vider les campagnes depuis un fichier
          qui les ignore couperait l'envoi.
        */
        if (payload.emailOpenHits !== undefined) await tx.emailOpenHit.deleteMany();
        if (payload.emailLinkClicks !== undefined) await tx.emailLinkClick.deleteMany();
        if (payload.emailReplies !== undefined) await tx.emailReply.deleteMany();
        if (payload.departures !== undefined) await tx.sequenceDeparture.deleteMany();
        if (payload.enrollments !== undefined) await tx.sequenceEnrollment.deleteMany();
        if (payload.emailSends !== undefined) await tx.emailSend.deleteMany();
        if (payload.emailStepVariants !== undefined) await tx.emailStepVariant.deleteMany();
        if (payload.emailSequenceSteps !== undefined) await tx.emailSequenceStep.deleteMany();
        if (payload.emailSequences !== undefined) await tx.emailSequence.deleteMany();
        // Les travaux de composition en cours tombent avec leur campagne : ils
        // sont transitoires, et `NOT_BACKED_UP` le déclare.
        if (payload.campaigns !== undefined) await tx.campaign.deleteMany();
        if (payload.dealStageVisits !== undefined) await tx.dealStageVisit.deleteMany();
        if (payload.domainRejections !== undefined) await tx.domainRejection.deleteMany();
        if (payload.signatories !== undefined) await tx.signatory.deleteMany();

        // Ordre de suppression contraint par les clés étrangères.
        await tx.activity.deleteMany();
        await tx.task.deleteMany();
        await tx.deal.deleteMany();
        await tx.contact.deleteMany();
        await tx.company.deleteMany();
        await tx.stage.deleteMany();
        await tx.sequenceStep.deleteMany();
        await tx.sequence.deleteMany();
        await tx.settingsList.deleteMany();
        await tx.settings.deleteMany();


        await tx.stage.createMany({ data: payload.stages });
        await tx.company.createMany({ data: payload.companies });
        await tx.contact.createMany({ data: payload.contacts });
        await tx.deal.createMany({ data: payload.deals });
        await tx.activity.createMany({ data: payload.activities });
        await tx.task.createMany({ data: payload.tasks });
        await tx.sequence.createMany({ data: payload.sequences });
        await tx.sequenceStep.createMany({ data: payload.sequenceSteps });
        await tx.settingsList.createMany({ data: payload.settingsLists });
        // **Une table née après la sauvegarde n'est pas effacée par elle.**
        // La suppression n'a lieu que si le fichier porte la section : une
        // sauvegarde d'avant le jalon 53 qui viderait les rôles — ou d'avant le
        // jalon 54 qui viderait les boîtes, donc couperait l'envoi — serait
        // exactement l'incident du jalon 42 sous une autre forme. (Corrige au
        // passage le comportement du jalon 53, qui vidait puis ne recréait pas.)
        if (payload.mailboxes !== undefined) {
          // `deleteMany` échouerait sur une boîte tenue par une campagne : on
          // réécrit **par identifiant** au lieu de vider, et les boîtes
          // inconnues de la sauvegarde survivent — une restauration ne doit
          // pas couper une adresse d'envoi qu'elle ne connaît pas.
          //
          // Elles passent **avant les campagnes** : `Campaign.mailboxId` est en
          // `Restrict`, donc une campagne dont la boîte n'existe pas encore
          // ferait échouer toute la restauration.
          for (const mailbox of payload.mailboxes) {
            await tx.mailbox.upsert({
              where: { id: mailbox.id },
              create: mailbox,
              update: mailbox,
            });
          }
        }
        if (payload.roleAngles !== undefined) {
          await tx.roleAngleLabel.deleteMany();
          await tx.roleAngle.deleteMany();
          // Les rôles avant leurs étiquettes : la clé étrangère l'impose.
          await tx.roleAngle.createMany({ data: payload.roleAngles });
          if (payload.roleAngleLabels !== undefined) {
            await tx.roleAngleLabel.createMany({ data: payload.roleAngleLabels });
          }
        }
        /*
          Les listes, restaurées **seulement si la sauvegarde en porte** — même
          garde que les rôles et les boîtes ci-dessus : un fichier d'avant le
          jalon 77 ne doit pas effacer des listes qu'il ne connaît pas.

          Les appartenances viennent après les contacts, qui viennent d'être
          recréés : la clé étrangère l'impose, et une appartenance dont la fiche
          n'est plus dans la sauvegarde est écartée plutôt que de faire échouer
          la restauration entière.
        */
        if (payload.customFilters !== undefined) {
          await tx.customFilterMember.deleteMany();
          await tx.customFilter.deleteMany();
          await tx.customFilter.createMany({ data: payload.customFilters });
          if (payload.customFilterMembers !== undefined) {
            const known = new Set(payload.contacts.map((contact) => contact.id));
            await tx.customFilterMember.createMany({
              data: payload.customFilterMembers.filter((member) => known.has(member.contactId)),
            });
          }
        }
        if (payload.taskTabs !== undefined) {
          await tx.taskTab.deleteMany();
          await tx.taskTab.createMany({ data: payload.taskTabs });
        }
        /*
          **L'histoire de prospection, parents avant enfants** (jalon 110).

          Une ligne dont la clé étrangère **obligatoire** manque ne peut pas
          être recréée : elle est écartée et **comptée**, pas tue. Une clé
          **facultative** manquante est mise à `null` au lieu de faire tomber la
          ligne entière : un envoi orphelin est un fait du produit depuis le
          jalon 39, pas une anomalie.
        */
        const knownContactIds = new Set(payload.contacts.map((contact) => contact.id));
        const knownCompanyIds = new Set(payload.companies.map((company) => company.id));

        if (payload.dealStageVisits !== undefined) {
          const knownDeals = new Set(payload.deals.map((deal) => deal.id));
          const knownStages = new Set(payload.stages.map((stage) => stage.id));
          await tx.dealStageVisit.createMany({
            data: placeable(
              payload.dealStageVisits,
              (visit) => knownDeals.has(visit.dealId) && knownStages.has(visit.stageId),
              "passages d'étape",
              skipped,
            ),
          });
        }
        if (payload.domainRejections !== undefined) {
          await tx.domainRejection.createMany({
            data: placeable(
              payload.domainRejections,
              (row) => knownCompanyIds.has(row.companyId),
              "domaines refusés",
              skipped,
            ),
          });
        }
        if (payload.signatories !== undefined) {
          await tx.signatory.createMany({ data: payload.signatories });
        }
        if (payload.agents !== undefined) {
          /*
            **Par upsert, jamais par suppression.** `AgentPhoto` tient à
            `Agent` par une cascade, et les portraits sont hors sauvegarde :
            vider la table les détruirait, c'est-à-dire créerait une perte là
            où il n'y en avait pas. Même raisonnement que pour les boîtes.
          */
          for (const agent of payload.agents) {
            await tx.agent.upsert({
              where: { slug: agent.slug },
              create: agent,
              update: agent,
            });
          }
        }
        if (payload.campaigns !== undefined) {
          const knownMailboxes = new Set(
            (payload.mailboxes ?? []).map((mailbox) => mailbox.id),
          );
          // Une campagne sans sa boîte ne peut pas être recréée : `Restrict`.
          // Elle est écartée et comptée — jamais rattachée à une autre boîte,
          // ce qui ferait partir des emails depuis la mauvaise adresse.
          await tx.campaign.createMany({
            data: placeable(
              payload.campaigns,
              (campaign) => knownMailboxes.has(campaign.mailboxId),
              "campagnes",
              skipped,
            ),
          });
        }
        /*
          Les campagnes connues : celles du fichier, ou — quand il n'en porte
          pas — **celles qui sont encore en base**. Un fichier d'avant le jalon
          110 ne doit pas faire perdre au journal son rattachement à une
          campagne qui, elle, n'a pas bougé.
        */
        const campaignIds = new Set(
          payload.campaigns !== undefined
            ? payload.campaigns.map((campaign) => campaign.id)
            : (await tx.campaign.findMany({ select: { id: true } })).map(
                (campaign) => campaign.id,
              ),
        );
        if (payload.emailSequences !== undefined) {
          await tx.emailSequence.createMany({
            data: payload.emailSequences.map((sequence) => ({
              ...sequence,
              campaignId:
                sequence.campaignId != null && campaignIds.has(sequence.campaignId)
                  ? sequence.campaignId
                  : null,
            })),
          });
        }
        const sequenceIds = new Set(
          (payload.emailSequences ?? []).map((sequence) => sequence.id),
        );
        if (payload.emailSequenceSteps !== undefined) {
          await tx.emailSequenceStep.createMany({
            data: placeable(
              payload.emailSequenceSteps,
              (step) => sequenceIds.has(step.sequenceId),
              "étapes d'email",
              skipped,
            ),
          });
        }
        if (payload.emailStepVariants !== undefined) {
          const knownSteps = new Set(
            (payload.emailSequenceSteps ?? [])
              .filter((step) => sequenceIds.has(step.sequenceId))
              .map((step) => step.id),
          );
          await tx.emailStepVariant.createMany({
            data: placeable(
              payload.emailStepVariants,
              (variant) => knownSteps.has(variant.stepId),
              "variantes d'étape",
              skipped,
            ),
          });
        }
        const placedEnrollments =
          payload.enrollments === undefined
            ? []
            : placeable(
                payload.enrollments,
                (enrollment) =>
                  sequenceIds.has(enrollment.sequenceId) &&
                  knownContactIds.has(enrollment.contactId),
                "inscriptions",
                skipped,
              );
        if (payload.enrollments !== undefined) {
          await tx.sequenceEnrollment.createMany({ data: placedEnrollments });
        }
        if (payload.departures !== undefined) {
          const placedIds = new Set(placedEnrollments.map((enrollment) => enrollment.id));
          await tx.sequenceDeparture.createMany({
            data: placeable(
              payload.departures,
              (departure) => placedIds.has(departure.enrollmentId),
              "départs composés",
              skipped,
            ),
          });
        }
        if (payload.emailSends !== undefined) {
          // `contactId` facultatif : un envoi dont la fiche a disparu reste un
          // envoi. On le **détache** au lieu de le perdre, et on le compte.
          let detached = 0;
          await tx.emailSend.createMany({
            data: payload.emailSends.map((send) => {
              const keep = send.contactId != null && knownContactIds.has(send.contactId);
              if (send.contactId != null && !keep) detached += 1;
              return { ...send, contactId: keep ? send.contactId : null };
            }),
          });
          if (detached > 0) skipped["envois détachés de leur contact"] = detached;
        }
        const sendIds = new Set((payload.emailSends ?? []).map((send) => send.id));
        if (payload.emailReplies !== undefined) {
          await tx.emailReply.createMany({
            data: payload.emailReplies.map((reply) => ({
              ...reply,
              emailSendId:
                reply.emailSendId != null && sendIds.has(reply.emailSendId)
                  ? reply.emailSendId
                  : null,
              contactId:
                reply.contactId != null && knownContactIds.has(reply.contactId)
                  ? reply.contactId
                  : null,
            })),
          });
        }
        if (payload.emailOpenHits !== undefined) {
          await tx.emailOpenHit.createMany({
            data: placeable(
              payload.emailOpenHits,
              (hit) => sendIds.has(hit.emailSendId),
              "chargements de pixel",
              skipped,
            ),
          });
        }
        if (payload.emailLinkClicks !== undefined) {
          await tx.emailLinkClick.createMany({
            data: placeable(
              payload.emailLinkClicks,
              (click) => sendIds.has(click.emailSendId),
              "clics",
              skipped,
            ),
          });
        }

        /*
          Les événements viennent après les contacts, les sociétés et les
          campagnes : la clé étrangère l'impose. Un événement dont la fiche
          n'est plus dans la sauvegarde est écarté **et compté**.

          **La campagne, elle, revient** depuis le jalon 110. Jusque-là elle
          était forcée à `null` parce que les campagnes n'étaient pas
          sauvegardées : une restauration rangeait donc tout le journal sous
          « Hors campagne », ce qui affirmait quelque chose de faux. Elle n'est
          remise à `null` que si la campagne citée manque réellement.
        */
        if (payload.outreachEvents !== undefined) {
          await tx.outreachEvent.deleteMany();
          await tx.outreachEvent.createMany({
            data: placeable(
              payload.outreachEvents,
              (event) => knownContactIds.has(event.contactId),
              "événements de prospection",
              skipped,
            ).map((event) => ({
              ...event,
              companyId:
                event.companyId != null && knownCompanyIds.has(event.companyId)
                  ? event.companyId
                  : null,
              campaignId:
                event.campaignId != null && campaignIds.has(event.campaignId)
                  ? event.campaignId
                  : null,
            })),
          });
        }
        if (payload.settings != null) {
          await tx.settings.create({ data: payload.settings });
        }
      },
      { timeout: 120_000, maxWait: 20_000 },
    );
  } catch (error) {
    console.error("[backup] restauration refusée", error);
    return {
      ok: false,
      message:
        "La restauration a été refusée par la base ; aucune donnée n'a été supprimée. " +
        "Vérifiez que le fichier vient bien de cette application.",
    };
  }

  /*
    Les comptes sont relus **en base**, après la transaction : ce que la
    restauration affirme avoir rendu est ce que la base porte réellement, pas
    la longueur des tableaux du fichier.
  */
  const counts = {
    étapes: await prisma.stage.count(),
    sociétés: await prisma.company.count(),
    contacts: await prisma.contact.count(),
    affaires: await prisma.deal.count(),
    interactions: await prisma.activity.count(),
    tâches: await prisma.task.count(),
    séquences: await prisma.sequence.count(),
    campagnes: await prisma.campaign.count(),
    inscriptions: await prisma.sequenceEnrollment.count(),
    départs: await prisma.sequenceDeparture.count(),
    envois: await prisma.emailSend.count(),
    réponses: await prisma.emailReply.count(),
    clics: await prisma.emailLinkClick.count(),
    événements: await prisma.outreachEvent.count(),
  };

  return { ok: true, counts, skipped, warnings };
}
