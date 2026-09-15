/**
 * Les puces d'agent de `/conseil/suggestions`.
 *
 * **`enabled` décide de ce qui s'affiche, partout.** Le jalon 32 a désactivé
 * sept agents plutôt que de les supprimer — leurs conversations, leurs constats
 * et leur historique de vacations valaient mieux qu'un `DELETE` irréversible —
 * et quatre surfaces devaient respecter ce drapeau. Celle-ci ne le respectait
 * pas : elle tirait ses puces de `SHIFTS`, une liste **écrite dans le code**,
 * qui ne peut par construction rien savoir de l'activation. Sarah, désactivée
 * depuis le jalon 32 et dont aucune vacation ne tourne plus, y gardait donc sa
 * puce.
 *
 * C'est le même défaut que le lanceur de vacations du jalon 32, au même
 * endroit : **le filtre appartient au code qui lit la base, jamais à la liste
 * écrite en dur**.
 *
 * Une exception, et c'est la règle du filtre orphelin du jalon 31 : un agent
 * **actuellement sélectionné** garde sa puce même désactivé. Sans cela, un lien
 * mis en favori sur `?agent=sarah` ouvrirait une liste filtrée qu'aucun
 * contrôle ne nomme et qu'on ne pourrait annuler qu'en éditant l'URL.
 */

export interface ShiftChip {
  readonly agentId: string;
  /** Le nom réglé, jamais le slug : renommer un agent renomme sa puce. */
  readonly label: string;
}

export function shiftChips(
  shifts: readonly { readonly agentId: string }[],
  profiles: readonly { readonly slug: string; readonly name: string; readonly enabled: boolean }[],
  selected: string | undefined,
): ShiftChip[] {
  const byslug = new Map(profiles.map((profile) => [profile.slug, profile]));
  const chips: ShiftChip[] = [];

  for (const shift of shifts) {
    const profile = byslug.get(shift.agentId);
    // Un agent que la base ne connaît pas encore n'est pas un agent retiré :
    // c'est une vacation câblée avant son premier semis. On le montre.
    const visible = profile === undefined || profile.enabled || shift.agentId === selected;
    if (!visible) continue;
    chips.push({ agentId: shift.agentId, label: profile?.name ?? shift.agentId });
  }
  return chips;
}
