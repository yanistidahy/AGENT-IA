import { READ_TOOLS } from "./reads";
import { WRITE_TOOLS } from "./writes";
import type { ToolDefinition } from "./types";

export type { ActionSummary, ToolDefinition, ToolMode, ToolResult } from "./types";

const ALL: readonly ToolDefinition[] = [...READ_TOOLS, ...WRITE_TOOLS];

const BY_NAME = new Map(ALL.map((tool) => [tool.name, tool]));

export const ALL_TOOLS = ALL;

export const READ_TOOL_NAMES = READ_TOOLS.map((tool) => tool.name);
export const WRITE_TOOL_NAMES = WRITE_TOOLS.map((tool) => tool.name);

export function findTool(name: string): ToolDefinition | undefined {
  return BY_NAME.get(name);
}

/** Sous-ensemble autorisé pour un agent, dans l'ordre du registre. */
export function toolsFor(allowed: readonly string[]): ToolDefinition[] {
  const set = new Set(allowed);
  return ALL.filter((tool) => set.has(tool.name));
}
