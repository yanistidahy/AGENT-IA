/**
 * **Le canal d'une tâche devient une colonne, et cesse d'être deviné.**
 *
 * Jusqu'au jalon 104, l'onglet « Appels » reconnaissait une tâche d'appel **à
 * son intitulé** : il n'existait aucune colonne de canal, et le jalon 92 l'avait
 * assumé — « on reconnaît donc des formes, la liste est étroite ». Le prix était
 * écrit dans sa propre section « ce qui n'est pas fait » : *« Une tâche
 * intitulée « Joindre Sophie » n'y entrera pas. »*
 *
 * Le type est maintenant **saisi à la création**, donc su plutôt que supposé.
 * `isCallTitle` ne sert plus qu'une fois, à la reprise de l'existant : c'est une
 * transcription, pas une règle — exactement le statut des reports de feuille des
 * jalons 11, 21 et 25.
 *
 * Module pur : aucune dépendance à Prisma, aucun accès réseau.
 */

export const TASK_KINDS = ["tache", "appel", "email", "instagram"] as const;

export type TaskKind = (typeof TASK_KINDS)[number];

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  tache: "Tâche",
  appel: "Appel",
  email: "Email",
  instagram: "DM Instagram",
};

/**
 * La valeur par défaut, et c'est un choix.
 *
 * `tache` plutôt que `appel` : une tâche dont on ne sait rien ne doit pas
 * atterrir dans la file d'appels du matin, qui n'a de valeur que si tout ce
 * qu'elle contient se traite au téléphone.
 */
export const DEFAULT_TASK_KIND: TaskKind = "tache";

/**
 * Une valeur inconnue vaut `tache`, jamais une exception.
 *
 * Même posture que `toSubjectMode` (jalon 104) et `modelFor` (jalon 36) : une
 * valeur étrangère en base — une migration à moitié passée, une écriture
 * directe — ne doit pas faire tomber un écran de travail.
 */
export function toTaskKind(value: string): TaskKind {
  return TASK_KINDS.includes(value as TaskKind) ? (value as TaskKind) : DEFAULT_TASK_KIND;
}

export function isTaskKind(value: string): value is TaskKind {
  return TASK_KINDS.includes(value as TaskKind);
}

/**
 * L'intitulé d'une tâche d'appel, **pour la reprise de l'existant seulement**.
 *
 * La liste reste étroite, pour la raison du jalon 92 : un mot trop vague ferait
 * entrer dans l'onglet des tâches qui n'ont rien à voir, et un onglet qui ne
 * tient pas sa promesse ne se rouvre pas. Appliquée une fois par la migration,
 * elle n'est plus consultée ensuite — le type lu en base fait foi.
 */
export function isCallTitle(title: string): boolean {
  return /\b(appel|appeler|rappeler|t[ée]l[ée]phon)/i.test(title);
}

/** Le type qu'une tâche existante reçoit à la migration. */
export function kindFromTitle(title: string): TaskKind {
  return isCallTitle(title) ? "appel" : "tache";
}

/**
 * Un numéro composable, ou `null`.
 *
 * Le bouton d'appel n'apparaît que sur un numéro qui a une chance d'aboutir :
 * un champ libre peut porter « à demander au standard », et un lien `tel:` sur
 * cette phrase ne compose rien tout en ayant l'air d'un bouton. On exige donc au
 * moins six chiffres — le plus court numéro atteignable en France est un numéro
 * court à quatre chiffres, mais ceux-là ne figurent pas dans un CRM de
 * prospection.
 *
 * **La valeur stockée n'est jamais réécrite** : c'est la règle des liens du
 * jalon 10, et elle vaut ici comme ailleurs — l'export doit rendre ce que
 * l'utilisateur a saisi. Seul le `href` est normalisé.
 */
export function dialHref(phone: string): string | null {
  const digits = phone.replace(/[^0-9+]/g, "");
  const count = digits.replace(/\D/g, "").length;
  if (count < 6) return null;
  return `tel:${digits}`;
}
