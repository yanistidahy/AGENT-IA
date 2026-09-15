/**
 * Le vocabulaire des inscrits d'une campagne : leurs états, et la règle qui
 * les dérive.
 *
 * **Ici et non dans `lib/api/`** : la liste des inscrits est rendue par un
 * composant client, qui a besoin des libellés et du type. `lib/api/campaigns.ts`
 * porte `import "server-only"` — l'y laisser ferait entrer Prisma dans le
 * paquet du navigateur, et le build le refuse (à raison).
 */

/**
 * Le statut d'une inscription **retirée à la main**.
 *
 * Distinct de `stopped`, qui dit que le produit a arrêté l'envoi — réponse
 * reçue, fiche close. Retirer, c'est un geste de l'utilisateur : la personne
 * quitte la campagne, la liste ne la montre plus, et elle redevient
 * réinscriptible. Le mot vit dans le domaine parce que trois couches le
 * comparent : la liste des inscrits, l'inscription, et le retrait.
 */
export const REMOVED = "removed";

/** L'état d'un inscrit, tel que la liste le filtre. */
export type MemberState = "pending" | "waiting" | "replied" | "stopped";

export interface CampaignMember {
  readonly enrollmentId: string;
  readonly contactId: string;
  readonly name: string;
  readonly company: string;
  readonly role: string;
  /** Étape atteinte : 0 = rien n'est encore parti. */
  readonly step: number;
  readonly steps: number;
  readonly lastSentAt: Date | null;
  readonly opened: boolean;
  readonly repliedAt: Date | null;
  readonly state: MemberState;
  /** Pourquoi l'inscription s'est arrêtée, quand elle l'est. */
  readonly stopReason: string;
}

/**
 * L'état d'un inscrit, dérivé — jamais stocké.
 *
 * Quatre états, dans l'ordre où ils comptent pour décider quoi faire :
 * arrêtée (elle ne recevra plus rien, et la raison est écrite), a répondu
 * (c'est gagné, on sort de la mécanique), en attente (écrit, silence), et pas
 * encore écrit. Le dériver plutôt que le stocker garantit qu'il ne peut pas
 * contredire les envois et les réponses — c'est la règle du statut de relance
 * du jalon 6, appliquée ici.
 */
export function memberState(input: {
  readonly status: string;
  readonly lastSentAt: Date | null;
  readonly repliedAt: Date | null;
}): MemberState {
  if (input.repliedAt !== null) return "replied";
  if (input.status !== "active") return "stopped";
  return input.lastSentAt === null ? "pending" : "waiting";
}

export const MEMBER_STATES: ReadonlyArray<{ value: MemberState; label: string }> = [
  { value: "pending", label: "Pas encore écrit" },
  { value: "waiting", label: "Silencieux" },
  { value: "replied", label: "A répondu" },
  { value: "stopped", label: "Arrêtés" },
];

