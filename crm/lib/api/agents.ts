import { z } from "zod";
import { prisma } from "../db";
import {
  AGENTS,
  DEFAULT_AGENT_SLUG,
  findAgent,
  initialsOf,
  isReadOnly,
  isUnlocked,
  systemPromptFor,
  type AgentDefinition,
} from "../agents/registry";
import { SHIFT_CADENCES, type ShiftCadence } from "../domain/agent-identity";
import type { Starter } from "../agents/starters";

/**
 * Identité du conseil : la moitié réglable des agents.
 *
 * Le partage est net et c'est tout l'intérêt du jalon :
 *
 * - **code** (`lib/agents/registry.ts`) — le slug, la personnalité, les outils,
 *   le verrou, le périmètre. Ce qui décide du *comportement* ;
 * - **donnée** (table `agents`) — le nom, le rôle affiché, la photo, l'ordre,
 *   la cadence, l'activation. Ce qui décide de l'*apparence*.
 *
 * Les deux se rejoignent ici, et jamais ailleurs. Comme le prompt est retrouvé
 * par le slug, renommer un agent ne peut pas changer ce qu'il fait.
 */

/** Ce que voit l'application une fois l'identité résolue. */
export interface AgentProfile {
  readonly slug: string;
  readonly name: string;
  readonly role: string;
  readonly initials: string;
  readonly color: string;
  readonly scope: string;
  /** Amorces de conversation, pour l'écran d'accueil d'un fil vide. */
  readonly starters: readonly Starter[];
  readonly enabled: boolean;
  readonly order: number;
  readonly cadence: ShiftCadence;
  readonly locked: boolean;
  readonly readOnly: boolean;
  readonly hasPhoto: boolean;
  /** Jeton de version de la photo, pour l'URL. Vide s'il n'y en a pas. */
  readonly photoVersion: string;
}

interface StoredIdentity {
  readonly name: string;
  readonly role: string;
  readonly enabled: boolean;
  readonly order: number;
  readonly shiftCadence: string;
}

function cadenceOf(value: string): ShiftCadence {
  return SHIFT_CADENCES.some((candidate) => candidate === value)
    ? (value as ShiftCadence)
    : "none";
}

/**
 * Fusionne une définition de code avec la ligne de base correspondante.
 *
 * L'absence de ligne n'est pas une erreur : on retombe sur les valeurs du
 * registre. Un agent ajouté au code apparaît donc immédiatement, avant même que
 * la migration qui le sème ait tourné — et une lecture ne provoque jamais
 * d'écriture pour « réparer » la base.
 */
function merge(
  definition: AgentDefinition,
  stored: StoredIdentity | undefined,
  photo: { readonly version: string } | undefined,
  index: number,
): AgentProfile {
  const name = stored?.name.trim() === "" || stored === undefined ? definition.name : stored.name;
  const role = stored === undefined || stored.role.trim() === "" ? definition.specialty : stored.role;

  return {
    slug: definition.slug,
    name,
    role,
    initials: initialsOf(name),
    color: definition.color,
    scope: definition.scope,
    starters: definition.starters,
    enabled: stored?.enabled ?? true,
    order: stored?.order ?? index,
    cadence: cadenceOf(stored?.shiftCadence ?? "none"),
    locked: !isUnlocked(definition),
    readOnly: isReadOnly(definition),
    hasPhoto: photo !== undefined,
    photoVersion: photo?.version ?? "",
  };
}

/**
 * Le conseil au complet, ordonné.
 *
 * Ne lit **jamais** les octets des portraits : seules la version et l'existence
 * remontent. C'est la raison d'être de la table séparée — cette fonction est
 * appelée à chaque rendu de `/conseil` et de `/reglages`.
 */
export async function listAgentProfiles(): Promise<AgentProfile[]> {
  const [rows, photos] = await Promise.all([
    prisma.agent.findMany({
      select: { slug: true, name: true, role: true, enabled: true, order: true, shiftCadence: true },
    }),
    prisma.agentPhoto.findMany({ select: { slug: true, version: true } }),
  ]);

  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  const photoBySlug = new Map(photos.map((photo) => [photo.slug, photo]));

  return AGENTS.map((definition, index) =>
    merge(definition, bySlug.get(definition.slug), photoBySlug.get(definition.slug), index),
  ).sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
}

export async function findAgentProfile(slug: string): Promise<AgentProfile | null> {
  const profiles = await listAgentProfiles();
  return profiles.find((profile) => profile.slug === slug) ?? null;
}

/**
 * Le prompt système d'un agent, sous son identité courante.
 *
 * C'est le seul chemin par lequel un prompt doit être construit : il est le
 * seul à connaître à la fois le fichier de personnalité et le nom réglé.
 */
export async function promptForAgent(slug: string): Promise<string | null> {
  const definition = findAgent(slug);
  if (definition === undefined) return null;

  const profiles = await listAgentProfiles();
  const self = profiles.find((profile) => profile.slug === slug);
  if (self === undefined) return null;

  return systemPromptFor(definition, {
    name: self.name,
    role: self.role,
    colleagues: profiles
      .filter((profile) => profile.slug !== slug && profile.enabled && !profile.locked)
      .map((profile) => ({ name: profile.name, role: profile.role })),
  });
}

/** L'agent ouvert par défaut, en respectant l'activation et l'ordre. */
export async function defaultAgentSlug(): Promise<string> {
  const profiles = await listAgentProfiles();
  const usable = profiles.filter((profile) => profile.enabled && !profile.locked);
  const preferred = usable.find((profile) => profile.slug === DEFAULT_AGENT_SLUG);
  return preferred?.slug ?? usable[0]?.slug ?? DEFAULT_AGENT_SLUG;
}

export const updateAgentSchema = z.object({
  name: z.string().trim().min(1, "Le nom ne peut pas être vide").max(40).optional(),
  role: z.string().trim().max(80).optional(),
  enabled: z.boolean().optional(),
  order: z.number().int().min(0).max(99).optional(),
  cadence: z.enum(SHIFT_CADENCES).optional(),
});

export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;

export type UpdateAgentResult =
  | { readonly ok: true; readonly agent: AgentProfile }
  | { readonly ok: false; readonly message: string };

/**
 * Met à jour l'identité d'un agent.
 *
 * Le `slug` n'est pas modifiable, et ce n'est pas un oubli : il indexe le
 * prompt, les conversations, les recommandations et les vacations. Le rendre
 * éditable transformerait un simple renommage en migration de données.
 */
export async function updateAgent(
  slug: string,
  input: UpdateAgentInput,
): Promise<UpdateAgentResult> {
  const definition = findAgent(slug);
  if (definition === undefined) {
    return { ok: false, message: "Agent inconnu." };
  }

  const data = {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.role === undefined ? {} : { role: input.role }),
    ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
    ...(input.order === undefined ? {} : { order: input.order }),
    ...(input.cadence === undefined ? {} : { shiftCadence: input.cadence }),
  };

  await prisma.agent.upsert({
    where: { slug },
    update: data,
    create: {
      slug,
      name: input.name ?? definition.name,
      role: input.role ?? definition.specialty,
      enabled: input.enabled ?? true,
      order: input.order ?? AGENTS.findIndex((agent) => agent.slug === slug),
      shiftCadence: input.cadence ?? "none",
    },
  });

  const agent = await findAgentProfile(slug);
  if (agent === null) return { ok: false, message: "Agent introuvable après mise à jour." };
  return { ok: true, agent };
}
