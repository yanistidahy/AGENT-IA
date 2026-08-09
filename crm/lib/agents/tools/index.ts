import { READ_TOOLS } from "./reads";
import {
  getTimeline,
  listAlerts,
  listClients,
  listNeglectedContacts,
  listReminders,
  listSequencesTool,
} from "./reads-crm";
import { WRITE_TOOLS } from "./writes";
import type { ToolDefinition } from "./types";

export type { ActionSummary, ToolDefinition, ToolMode, ToolResult } from "./types";

/**
 * Lectures ouvertes après les jalons 3 à 6. Elles rejoignent `READ_TOOLS`, donc
 * tout agent dont la liste blanche contient `READS` en hérite automatiquement —
 * y compris Brutus, qui reste en lecture seule.
 */
const CRM_READ_TOOLS: readonly ToolDefinition[] = [
  listReminders,
  listNeglectedContacts,
  listAlerts,
  getTimeline,
  listSequencesTool,
  listClients,
];

const ALL_READS: readonly ToolDefinition[] = [...READ_TOOLS, ...CRM_READ_TOOLS];

const ALL: readonly ToolDefinition[] = [...ALL_READS, ...WRITE_TOOLS];

const BY_NAME = new Map(ALL.map((tool) => [tool.name, tool]));

export const ALL_TOOLS = ALL;

export const READ_TOOL_NAMES = ALL_READS.map((tool) => tool.name);
export const WRITE_TOOL_NAMES = WRITE_TOOLS.map((tool) => tool.name);

export function findTool(name: string): ToolDefinition | undefined {
  return BY_NAME.get(name);
}

/** Sous-ensemble autorisé pour un agent, dans l'ordre du registre. */
export function toolsFor(allowed: readonly string[]): ToolDefinition[] {
  const set = new Set(allowed);
  return ALL.filter((tool) => set.has(tool.name));
}
