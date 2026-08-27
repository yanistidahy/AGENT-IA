import type { ApiErrorBody } from "../api/errors";

/**
 * Appels client vers l'API des affaires.
 *
 * Les erreurs sont renvoyées, jamais levées : chaque appelant est un
 * gestionnaire d'évènement qui doit afficher le message plutôt que laisser
 * remonter une exception non capturée.
 */
export type ApiResult<T> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly message: string;
      readonly fields?: Record<string, string[]>;
    };

function isErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const { error } = value;
  return typeof error === "object" && error !== null && "message" in error;
}

/** Tâche créée ou déplacée par une règle d'automatisation, à annoncer à l'écran. */
export interface AutoTaskPayload {
  readonly id: string;
  readonly title: string;
  readonly due: string;
  readonly effect: "created" | "moved";
}

export interface DealPayload {
  readonly deal: { readonly id: string };
  readonly autoTask: AutoTaskPayload | null;
}

/**
 * Rien de muet : le déplacement d'étape peut créer une tâche, l'écran doit le
 * dire. Une enveloppe illisible vaut « pas de tâche » plutôt qu'une erreur —
 * l'affaire, elle, a bien bougé.
 */
function readAutoTask(value: unknown): AutoTaskPayload | null {
  if (typeof value !== "object" || value === null) return null;
  const bag: Record<string, unknown> = { ...value };
  const { id, title, due, effect } = bag;
  if (typeof id !== "string" || typeof title !== "string" || typeof due !== "string") {
    return null;
  }
  return { id, title, due, effect: effect === "moved" ? "moved" : "created" };
}

/** Les trois points d'entrée renvoient la même enveloppe : on la vérifie au lieu de l'affirmer. */
function isDealPayload(value: unknown): value is { readonly deal: { readonly id: string } } {
  if (typeof value !== "object" || value === null || !("deal" in value)) return false;
  const { deal } = value;
  return (
    typeof deal === "object" &&
    deal !== null &&
    "id" in deal &&
    typeof deal.id === "string"
  );
}

/**
 * Phrase annonçant la tâche automatique. Un seul libellé pour le Kanban et le
 * tiroir : deux formulations pour le même évènement donneraient l'impression de
 * deux mécanismes différents.
 */
export function autoTaskNotice(task: AutoTaskPayload): string {
  const due = new Date(task.due).toLocaleDateString("fr-FR");
  const verb = task.effect === "created" ? "Tâche créée" : "Tâche déplacée";
  return `${verb} : « ${task.title} », pour le ${due}.`;
}

async function send(url: string, init: RequestInit): Promise<ApiResult<DealPayload>> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    return { ok: false, message: "Le serveur est injoignable. Vérifiez votre connexion." };
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (isErrorBody(payload)) {
      const { message, fields } = payload.error;
      return fields === undefined ? { ok: false, message } : { ok: false, message, fields };
    }
    return { ok: false, message: `Erreur serveur (${response.status}).` };
  }

  if (!isDealPayload(payload)) {
    return { ok: false, message: "Réponse inattendue du serveur." };
  }

  const autoTask =
    typeof payload === "object" && payload !== null && "autoTask" in payload
      ? readAutoTask(payload.autoTask)
      : null;

  return { ok: true, data: { deal: payload.deal, autoTask } };
}

export function createDeal(body: unknown): Promise<ApiResult<DealPayload>> {
  return send("/api/deals", { method: "POST", body: JSON.stringify(body) });
}

export function updateDeal(id: string, body: unknown): Promise<ApiResult<DealPayload>> {
  return send(`/api/deals/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function moveDealStage(id: string, stageId: string): Promise<ApiResult<DealPayload>> {
  return send(`/api/deals/${id}/move-stage`, {
    method: "POST",
    body: JSON.stringify({ stageId }),
  });
}

export function markDealLost(id: string, reason: string): Promise<ApiResult<DealPayload>> {
  return send(`/api/deals/${id}/lost`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function reopenDeal(id: string): Promise<ApiResult<DealPayload>> {
  return send(`/api/deals/${id}/reopen`, { method: "POST" });
}

/** Ce que la suppression détruirait, et si elle est seulement possible. */
export interface DeletionPayload {
  readonly name: string;
  readonly amount: number;
  readonly verdict: {
    readonly deletable: boolean;
    readonly collateral: readonly string[];
  };
  readonly refusal: string;
}

function isDeletionPayload(value: unknown): value is { readonly suppression: DeletionPayload } {
  if (typeof value !== "object" || value === null || !("suppression" in value)) return false;
  const { suppression } = value;
  if (typeof suppression !== "object" || suppression === null) return false;
  const bag: Record<string, unknown> = { ...suppression };
  return (
    typeof bag.name === "string" &&
    typeof bag.amount === "number" &&
    typeof bag.refusal === "string" &&
    typeof bag.verdict === "object" &&
    bag.verdict !== null
  );
}

/**
 * Les faits, lus avant d'ouvrir la confirmation. Un aller-retour de plus, et
 * c'est voulu : demander « supprimer ? » sans savoir ce qui va partir revient à
 * faire confirmer à l'aveugle.
 */
export async function readDeletionReport(id: string): Promise<ApiResult<DeletionPayload>> {
  let response: Response;
  try {
    response = await fetch(`/api/deals/${id}?suppression=1`);
  } catch {
    return { ok: false, message: "Le serveur est injoignable. Vérifiez votre connexion." };
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    return isErrorBody(payload)
      ? { ok: false, message: payload.error.message }
      : { ok: false, message: `Erreur serveur (${response.status}).` };
  }
  if (!isDeletionPayload(payload)) {
    return { ok: false, message: "Réponse inattendue du serveur." };
  }
  return { ok: true, data: payload.suppression };
}

/** Le refus arrive en 409 avec sa raison : elle est rendue telle quelle. */
export async function deleteDeal(id: string): Promise<ApiResult<{ readonly deleted: true }>> {
  let response: Response;
  try {
    response = await fetch(`/api/deals/${id}`, { method: "DELETE" });
  } catch {
    return { ok: false, message: "Le serveur est injoignable. Vérifiez votre connexion." };
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    return isErrorBody(payload)
      ? { ok: false, message: payload.error.message }
      : { ok: false, message: `Erreur serveur (${response.status}).` };
  }
  return { ok: true, data: { deleted: true } };
}
