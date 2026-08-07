import { ALFRED } from "./prompts/alfred";
import { BRUTUS } from "./prompts/brutus";
import { ETIENNE } from "./prompts/etienne";
import { HELOISE } from "./prompts/heloise";
import { NOAH } from "./prompts/noah";
import { OXANA } from "./prompts/oxana";
import { SACHA } from "./prompts/sacha";
import { VICTOR } from "./prompts/victor";
import { buildSystemPrompt } from "./prompts/shared";
import { READ_TOOL_NAMES, WRITE_TOOL_NAMES } from "./tools";

/**
 * Le conseil.
 *
 * Les agents sont du code versionné, pas de la donnée : ajouter un neuvième
 * agent revient à écrire un prompt et une entrée ici. Voir README.md.
 */

export interface AgentDefinition {
  readonly id: string;
  readonly name: string;
  readonly specialty: string;
  readonly initials: string;
  readonly color: string;
  readonly persona: string;
  /** Noms d'outils autorisés. L'ordre est celui du registre, pas celui-ci. */
  readonly tools: readonly string[];
  /** Verrouillé derrière un drapeau d'environnement. */
  readonly flag?: string;
}

const READS = READ_TOOL_NAMES;
const ALL_TOOLS = [...READ_TOOL_NAMES, ...WRITE_TOOL_NAMES];

export const AGENTS: readonly AgentDefinition[] = [
  {
    id: "alfred",
    name: "Alfred",
    specialty: "Directeur des Opérations",
    initials: "AL",
    color: "#0FA88F",
    persona: ALFRED,
    tools: ALL_TOOLS,
  },
  {
    id: "victor",
    name: "Victor",
    specialty: "Vision & Positionnement",
    initials: "VI",
    color: "#6D5AE6",
    persona: VICTOR,
    tools: [...READS, "create_task"],
  },
  {
    id: "oxana",
    name: "Oxana",
    specialty: "Offre & Pricing",
    initials: "OX",
    color: "#D99323",
    persona: OXANA,
    tools: [...READS, "update_deal"],
  },
  {
    id: "noah",
    name: "Noah",
    specialty: "Acquisition & Marketing",
    initials: "NO",
    color: "#2C7BE5",
    persona: NOAH,
    tools: [...READS, "create_task", "create_contact"],
  },
  {
    id: "sacha",
    name: "Sacha",
    specialty: "Sales & Closing",
    initials: "SA",
    color: "#E8503F",
    persona: SACHA,
    tools: [
      ...READS,
      "create_task",
      "log_interaction",
      "move_deal_stage",
      "update_deal",
    ],
  },
  {
    id: "heloise",
    name: "Héloïse",
    specialty: "Recrutement & Management",
    initials: "HÉ",
    color: "#0B7A68",
    persona: HELOISE,
    tools: [...READS, "create_task"],
  },
  {
    id: "etienne",
    name: "Étienne",
    specialty: "À définir",
    initials: "ÉT",
    color: "#63807A",
    persona: ETIENNE,
    tools: [],
    flag: "AGENT_ETIENNE_ENABLED",
  },
  {
    id: "brutus",
    name: "Brutus",
    specialty: "Franc-parlé & Scale",
    initials: "BR",
    color: "#8B5CF6",
    // Lecture seule, délibérément : Brutus commente, il n'agit pas.
    persona: BRUTUS,
    tools: READS,
  },
];

export const DEFAULT_AGENT_ID = "alfred";

const BY_ID = new Map(AGENTS.map((agent) => [agent.id, agent]));

export function findAgent(id: string): AgentDefinition | undefined {
  return BY_ID.get(id);
}

/**
 * Un agent verrouillé l'est tant que son drapeau ne vaut pas exactement "true".
 * Une variable absente, vide ou mal orthographiée laisse l'agent verrouillé —
 * c'est le sens sûr du défaut.
 */
export function isUnlocked(agent: AgentDefinition): boolean {
  if (agent.flag === undefined) return true;
  return process.env[agent.flag] === "true";
}

export function systemPromptFor(agent: AgentDefinition): string {
  return buildSystemPrompt(agent.persona);
}

/** Vue transmise au client : ni prompt, ni détail d'outillage. */
export interface AgentSummary {
  readonly id: string;
  readonly name: string;
  readonly specialty: string;
  readonly initials: string;
  readonly color: string;
  readonly locked: boolean;
  readonly readOnly: boolean;
}

export function agentSummaries(): AgentSummary[] {
  return AGENTS.map((agent) => ({
    id: agent.id,
    name: agent.name,
    specialty: agent.specialty,
    initials: agent.initials,
    color: agent.color,
    locked: !isUnlocked(agent),
    readOnly: agent.tools.every((tool) => READ_TOOL_NAMES.includes(tool)),
  }));
}
