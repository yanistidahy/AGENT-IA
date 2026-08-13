import { SABRINA } from "./prompts/sabrina";
import { BRUTUS } from "./prompts/brutus";
import { ETIENNE } from "./prompts/etienne";
import { HELOISE } from "./prompts/heloise";
import { NOAH } from "./prompts/noah";
import { OXANA } from "./prompts/oxana";
import { SARAH } from "./prompts/sarah";
import { VICTOR } from "./prompts/victor";
import { buildSystemPrompt, type PromptIdentity } from "./prompts/shared";
import { READ_TOOL_NAMES, WRITE_TOOL_NAMES } from "./tools";
import { startersFor, type Starter } from "./starters";

/**
 * Le conseil.
 *
 * Les agents sont du code versionné, pas de la donnée : ajouter un neuvième
 * agent revient à écrire un prompt et une entrée ici. Voir README.md.
 */

export interface AgentDefinition {
  /** Clé stable. Jamais modifiable depuis l'écran : c'est elle qui trouve le prompt. */
  readonly slug: string;
  /** Nom par défaut, utilisé tant que la base n'en porte pas d'autre. */
  readonly name: string;
  /** Rôle par défaut, même règle que le nom. */
  readonly specialty: string;
  readonly color: string;
  /** Ce que l'agent surveille, en une phrase. Décrit un comportement : c'est du code. */
  readonly scope: string;
  /** Amorces de conversation, spécifiques au périmètre. Voir `starters.ts`. */
  readonly starters: readonly Starter[];
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
    slug: "sabrina",
    starters: startersFor("sabrina"),
    name: "Sabrina",
    specialty: "Directrice des Opérations",
    color: "#4B3FE4",
    scope:
      "Arbitre les trois choses qui comptent aujourd'hui et surveille la qualité des données : fiches incomplètes, sociétés sans contact, statuts figés.",
    persona: SABRINA,
    tools: ALL_TOOLS,
  },
  {
    slug: "victor",
    starters: startersFor("victor"),
    name: "Victor",
    specialty: "Vision & Positionnement",
    color: "#6D5AE6",
    scope: "Regarde le portefeuille de haut : segments porteurs, positionnement, tendances de fond.",
    persona: VICTOR,
    tools: [...READS, "create_task"],
  },
  {
    slug: "oxana",
    starters: startersFor("oxana"),
    name: "Oxana",
    specialty: "Offre & Pricing",
    color: "#D99323",
    scope: "Le prix : structure de l'offre, marges, remises consenties et ce qu'elles coûtent.",
    persona: OXANA,
    tools: [...READS, "update_deal"],
  },
  {
    slug: "noah",
    starters: startersFor("noah"),
    name: "Noah",
    specialty: "Acquisition & Marketing",
    color: "#2C7BE5",
    scope: "Ce qui se passe avant le premier appel : origine des leads, qualité des sources, réchauffage.",
    persona: NOAH,
    // Acquisition : il crée des contacts et programme leur première relance.
    tools: [...READS, "create_task", "create_contact", "set_reminder"],
  },
  {
    slug: "sarah",
    starters: startersFor("sarah"),
    name: "Sarah",
    specialty: "Sales & Closing",
    color: "#E8503F",
    scope:
      "La discipline de relance : échéances dues ou dépassées, contacts silencieux au-delà du seuil, prospects touchés une fois et jamais repris.",
    persona: SARAH,
    // Sacha porte la relance de bout en bout : consigner, programmer la
    // prochaine, déclencher une séquence. Ce sont ses trois gestes quotidiens.
    tools: [
      ...READS,
      "create_task",
      "log_interaction",
      "move_deal_stage",
      "update_deal",
      "set_reminder",
      "run_sequence",
    ],
  },
  {
    slug: "heloise",
    starters: startersFor("heloise"),
    name: "Héloïse",
    specialty: "Recrutement & Management",
    color: "#3A2FC7",
    scope: "La charge de travail de l'équipe et le moment où il faudra être un de plus.",
    persona: HELOISE,
    tools: [...READS, "create_task"],
  },
  {
    slug: "etienne",
    starters: startersFor("etienne"),
    name: "Étienne",
    specialty: "À définir",
    color: "#6B7192",
    scope: "Domaine à définir. L'agent est verrouillé.",
    persona: ETIENNE,
    tools: [],
    flag: "AGENT_ETIENNE_ENABLED",
  },
  {
    slug: "brutus",
    starters: startersFor("brutus"),
    name: "Brutus",
    specialty: "Franc-parlé & Scale",
    color: "#8B5CF6",
    scope: "Le angle mort : ce que personne ne dit sur le passage à l'échelle. Lecture seule.",
    // Lecture seule, délibérément : Brutus commente, il n'agit pas.
    persona: BRUTUS,
    tools: READS,
  },
];

export const DEFAULT_AGENT_SLUG = "sabrina";

const BY_SLUG = new Map(AGENTS.map((agent) => [agent.slug, agent]));

export function findAgent(slug: string): AgentDefinition | undefined {
  return BY_SLUG.get(slug);
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

export function isReadOnly(agent: AgentDefinition): boolean {
  return agent.tools.every((tool) => READ_TOOL_NAMES.includes(tool));
}

/**
 * Prompt système d'un agent, sous l'identité qu'on lui a réglée.
 *
 * L'identité est un paramètre : le registre ne sait pas comment l'agent
 * s'appelle aujourd'hui, seule la base le sait. Passer un nom explicitement
 * évite qu'un appelant oublie de le faire et laisse l'agent se présenter sous
 * son nom d'usine.
 */
export function systemPromptFor(agent: AgentDefinition, identity: PromptIdentity): string {
  return buildSystemPrompt(agent.persona, identity);
}

/**
 * Initiales déduites du nom.
 *
 * Calculées et non stockées : le nom est réglable, des initiales enregistrées à
 * côté finiraient par le contredire — « Sabrina » affichée « AL ».
 */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/[\s-]+/).filter((part) => part !== "");
  const letters = parts.slice(0, 2).map((part) => [...part][0] ?? "");
  const joined = letters.join("").toUpperCase();
  if (joined !== "") return joined;
  return [...name.trim().toUpperCase()].slice(0, 2).join("");
}
