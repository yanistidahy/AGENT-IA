/**
 * **Ce que la sauvegarde porte, et ce qu'elle laisse — déclaré au même endroit.**
 *
 * Le jalon 109 a mesuré ce que coûtait l'absence de cette liste : `email_sends`
 * n'était pas sauvegardé, la restauration supprimait et recréait tous les
 * contacts, et `EmailSend.contactId` étant en `SetNull`, **chaque envoi perdait
 * sa personne**. Rien ne levait, rien ne s'affichait ; on le découvrait en
 * relançant une reprise qui ne retrouvait plus que 11 événements sur 33.
 *
 * Deux listes, donc, et la règle qui les lie : **tout modèle du schéma Prisma
 * est dans l'une ou dans l'autre**. `tests/backup-columns.test.ts` échoue en le
 * nommant si un modèle nouveau n'est déclaré nulle part — on ne peut plus
 * ajouter une table sans décider, par écrit, si une restauration doit la
 * rendre.
 *
 * Les deux listes servent aussi l'écran : `/reglages` affiche ce qu'une
 * restauration **ne rend pas**, avec la raison. Une liste qui ne sert qu'à un
 * test finit par mentir ; celle-ci est lue par quelqu'un avant de cliquer.
 */

/** Un modèle sauvegardé, et la clé qu'il porte dans le fichier JSON. */
export interface BackedUpTable {
  readonly model: string;
  readonly key: string;
  /** Ce que la ligne représente, en une phrase, pour l'écran. */
  readonly label: string;
}

/**
 * L'ordre n'est pas décoratif : c'est **l'ordre de création** à la
 * restauration, parents avant enfants. Les clés étrangères l'imposent, et
 * `restoreBackup` le suit de haut en bas.
 */
export const BACKED_UP_TABLES: readonly BackedUpTable[] = [
  { model: "Stage", key: "stages", label: "Étapes du pipeline" },
  { model: "Company", key: "companies", label: "Sociétés" },
  { model: "Contact", key: "contacts", label: "Contacts" },
  { model: "Deal", key: "deals", label: "Affaires" },
  { model: "DealStageVisit", key: "dealStageVisits", label: "Passages d'étape des affaires" },
  { model: "Activity", key: "activities", label: "Interactions" },
  { model: "Task", key: "tasks", label: "Tâches" },
  { model: "TaskTab", key: "taskTabs", label: "Onglets de tâches" },
  { model: "Settings", key: "settings", label: "Réglages" },
  { model: "SettingsList", key: "settingsLists", label: "Listes de référence" },
  { model: "Sequence", key: "sequences", label: "Séquences de tâches" },
  { model: "SequenceStep", key: "sequenceSteps", label: "Étapes de séquence" },
  { model: "RoleAngle", key: "roleAngles", label: "Angles par rôle" },
  { model: "RoleAngleLabel", key: "roleAngleLabels", label: "Libellés de rôle" },
  { model: "CustomFilter", key: "customFilters", label: "Filtres personnalisés" },
  { model: "CustomFilterMember", key: "customFilterMembers", label: "Appartenances aux filtres" },
  { model: "DomainRejection", key: "domainRejections", label: "Domaines refusés" },
  { model: "Signatory", key: "signatories", label: "Signataires" },
  { model: "Agent", key: "agents", label: "Agents du conseil" },
  { model: "Mailbox", key: "mailboxes", label: "Boîtes d'envoi (sans mot de passe)" },
  { model: "Campaign", key: "campaigns", label: "Campagnes" },
  { model: "EmailSequence", key: "emailSequences", label: "Séquences d'emails" },
  { model: "EmailSequenceStep", key: "emailSequenceSteps", label: "Étapes d'email" },
  { model: "EmailStepVariant", key: "emailStepVariants", label: "Variantes par groupe" },
  { model: "SequenceEnrollment", key: "enrollments", label: "Inscriptions aux campagnes" },
  { model: "SequenceDeparture", key: "departures", label: "Départs composés" },
  { model: "EmailSend", key: "emailSends", label: "Journal des envois" },
  { model: "EmailReply", key: "emailReplies", label: "Réponses relevées" },
  { model: "EmailOpenHit", key: "emailOpenHits", label: "Chargements du pixel" },
  { model: "EmailLinkClick", key: "emailLinkClicks", label: "Clics sur nos liens" },
  { model: "OutreachEvent", key: "outreachEvents", label: "Journal de prospection" },
  /*
    **Les anomalies de synchronisation sont sauvegardées, l'état ne l'est pas.**

    Un rapprochement ambigu — deux fiches portant la même adresse — est une
    décision qui attend quelqu'un. Elle n'est **pas** re-signalée au relevé
    suivant : l'événement ayant été écrit, la même activité ne repasse plus par
    le rapprochement. La perdre à une restauration perdrait donc la seule trace
    d'un arbitrage à rendre, et c'est pour cela que cette table entre dans le
    fichier alors que son nom fait penser à un journal technique.
  */
  { model: "LemlistIssue", key: "lemlistIssues", label: "Anomalies de synchronisation lemlist" },
];

/**
 * **Ce qu'une restauration ne rend pas, et pourquoi.**
 *
 * Chaque ligne est une décision, pas un oubli. Trois raisons seulement y
 * donnent droit : la donnée est **reconstructible** sans rien inventer, elle
 * est **transitoire** (un état de course qui n'a plus de sens après coup), ou
 * elle est **hors périmètre** et c'est écrit.
 */
export interface SkippedTable {
  readonly model: string;
  readonly label: string;
  /** La conséquence pour l'utilisateur, pas la justification technique. */
  readonly consequence: string;
}

export const NOT_BACKED_UP: readonly SkippedTable[] = [
  {
    model: "MailLogo",
    label: "Logo des emails",
    consequence: "À reposer dans Réglages : les fichiers binaires restent hors de la sauvegarde.",
  },
  {
    model: "MailVideo",
    label: "Vidéo de démonstration",
    consequence: "À reposer dans Réglages : les fichiers binaires restent hors de la sauvegarde.",
  },
  {
    model: "AgentPhoto",
    label: "Portraits des agents",
    consequence: "Les agents reprennent leurs initiales jusqu'au prochain téléversement.",
  },
  {
    model: "Conversation",
    label: "Conversations du conseil",
    consequence: "Les échanges avec les agents ne reviennent pas. C'est le plus gros manque restant.",
  },
  {
    model: "Message",
    label: "Messages des conversations",
    consequence: "Perdus avec leur conversation.",
  },
  {
    model: "Recommendation",
    label: "Recommandations du conseil",
    consequence:
      "Régénérées à la prochaine vacation — un constat écarté peut donc revenir une fois.",
  },
  {
    model: "ShiftRun",
    label: "Journal des vacations",
    consequence: "L'historique des passages du conseil repart de zéro.",
  },
  {
    model: "CompanyResearch",
    label: "Recherche web mise en cache",
    consequence: "Refaite à la demande, donc repayée à l'API. Aucun fait n'est inventé entre-temps.",
  },
  {
    model: "ResearchFact",
    label: "Faits de recherche",
    consequence: "Perdus avec leur recherche, et recollectés au besoin.",
  },
  {
    model: "ResearchSource",
    label: "Sources de recherche",
    consequence: "Perdues avec leur recherche, et recollectées au besoin.",
  },
  {
    model: "ApiUsage",
    label: "Consommation de l'API",
    consequence: "Le cumul du mois repart à zéro : le plafond de coût laisse donc repasser.",
  },
  {
    model: "SnapshotRun",
    label: "Journal des sauvegardes",
    consequence: "Le bandeau « sauvegarde en retard » s'affiche jusqu'au prochain passage.",
  },
  {
    model: "QueueDay",
    label: "Taille de la file du jour",
    consequence: "L'anneau d'avancement repart du jour même.",
  },
  {
    model: "QueueMark",
    label: "Éléments traités aujourd'hui",
    consequence: "L'anneau d'avancement repart du jour même.",
  },
  {
    model: "AutoSend",
    label: "Interrupteur d'envoi automatique",
    consequence: "Il revient **éteint** : le sens sûr, pour qu'une restauration n'envoie rien.",
  },
  {
    model: "CompositionJob",
    label: "Travaux de composition en cours",
    consequence: "Une composition interrompue est à relancer ; les départs déjà écrits sont rendus.",
  },
  {
    model: "LemlistSync",
    label: "État du relevé lemlist",
    consequence:
      "Le relevé repart d'une reprise d'historique complète : lemlist est réinterrogé depuis le début, et la contrainte d'unicité fait que rien n'est compté deux fois.",
  },
];

/** Tous les modèles déclarés, dans un sens ou dans l'autre. */
export function declaredModels(): readonly string[] {
  return [
    ...BACKED_UP_TABLES.map((table) => table.model),
    ...NOT_BACKED_UP.map((table) => table.model),
  ];
}
