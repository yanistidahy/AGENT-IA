/**
 * Événements SSE du fil de conversation.
 *
 * Un seul type discriminé partagé par le serveur et le client : le client
 * n'invente pas de forme, il fait un `switch` exhaustif sur `type`.
 */

export interface ProposedAction {
  readonly toolUseId: string;
  readonly toolName: string;
  readonly agentName: string;
  readonly headline: string;
  readonly details: readonly string[];
}

export type ChatEvent =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "thinking"; readonly text: string }
  | { readonly type: "tool_start"; readonly name: string; readonly label: string }
  | { readonly type: "tool_end"; readonly name: string; readonly empty: boolean }
  | { readonly type: "action_proposed"; readonly action: ProposedAction }
  | { readonly type: "done" }
  | { readonly type: "error"; readonly message: string };

/** Libellés des puces affichées en direct sous le fil. */
const TOOL_LABELS: Record<string, string> = {
  search_contacts: "cherche dans les contacts",
  get_company: "lit une fiche société",
  list_deals: "consulte le pipeline",
  get_deal_detail: "ouvre une affaire",
  list_tasks: "regarde les tâches",
  get_kpis: "calcule les indicateurs",
  get_stuck_deals: "repère les affaires qui stagnent",
  create_task: "prépare une tâche",
  log_interaction: "prépare une interaction",
  move_deal_stage: "prépare un déplacement d'étape",
  update_deal: "prépare une modification",
  create_contact: "prépare un contact",
};

export function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name;
}

export function encodeEvent(event: ChatEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
