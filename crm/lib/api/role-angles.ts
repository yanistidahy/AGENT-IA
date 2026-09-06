import "server-only";
import { z } from "zod";

import { prisma } from "../db";
import {
  matchRole,
  normalizeRoleLabel,
  roleAngleRule,
  unmatchedTitles,
  type RoleAngleLike,
  type RoleMatch,
  type UnmatchedTitle,
} from "../domain/role-angles";

/**
 * Les rôles destinataires et leurs notes d'angle.
 *
 * Le service ne décide rien : il lit, il écrit, et il délègue l'appariement à
 * `lib/domain/role-angles.ts`, qui est pur et testé sans base. C'est ce qui
 * permet à Alex, aux écrans et à la liste des non appariés de dire la même
 * chose — un rôle apparié ici et là-bas ne peut pas diverger, puisque c'est le
 * même code qui tranche.
 */

export interface RoleAngleRecord extends RoleAngleLike {
  readonly labels: readonly string[];
  /** Nombre de fiches dont la fonction tombe sur ce rôle. Calculé, jamais stocké. */
  readonly contacts: number;
}

/** Les rôles seuls, sans compter les fiches : ce dont l'appariement a besoin. */
export async function loadRoles(): Promise<RoleAngleLike[]> {
  const rows = await prisma.roleAngle.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true, angle: true, labels: { select: { label: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    angle: row.angle,
    labels: row.labels.map((entry) => entry.label),
  }));
}

/** Les intitulés portés par les fiches actives, avec leur nombre. */
async function titlesInUse(): Promise<{ title: string; contacts: number }[]> {
  const rows = await prisma.contact.groupBy({
    by: ["title"],
    _count: { _all: true },
  });
  return rows.map((row) => ({ title: row.title, contacts: row._count._all }));
}

export interface RoleCoverage {
  readonly roles: readonly RoleAngleRecord[];
  /** Ce qu'aucun rôle ne reconnaît — la liste de travail pour étendre les étiquettes. */
  readonly unmatched: readonly UnmatchedTitle[];
  /** Fiches sans aucune fonction : rien à régler ici, c'est une donnée à saisir. */
  readonly withoutTitle: number;
}

/**
 * L'état de la couverture : ce qui est reconnu, ce qui ne l'est pas.
 *
 * Les fiches sans fonction sont **comptées à part** plutôt que jetées dans les
 * non appariés : les deux appellent des gestes opposés — ajouter une étiquette
 * d'un côté, remplir une fiche de l'autre — et les mêler ferait chercher une
 * étiquette pour une information absente.
 */
export async function readRoleCoverage(): Promise<RoleCoverage> {
  const [roles, titles] = await Promise.all([loadRoles(), titlesInUse()]);

  const counts = new Map<string, number>();
  let withoutTitle = 0;

  for (const entry of titles) {
    if (normalizeRoleLabel(entry.title) === "") {
      withoutTitle += entry.contacts;
      continue;
    }
    const match = matchRole(entry.title, roles);
    if (match.kind === "role") {
      counts.set(match.role.id, (counts.get(match.role.id) ?? 0) + entry.contacts);
    }
  }

  return {
    roles: roles.map((role) => ({ ...role, contacts: counts.get(role.id) ?? 0 })),
    unmatched: unmatchedTitles(titles, roles),
    withoutTitle,
  };
}

export const roleAnglesSchema = z.object({
  roles: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Le nom du rôle ne peut pas être vide").max(80),
        angle: z.string().trim().max(4000),
        labels: z.array(z.string().trim().max(120)).max(40),
      }),
    )
    .max(30),
});

export type RoleAnglesInput = z.infer<typeof roleAnglesSchema>;

export type SaveRolesResult =
  | { readonly ok: true; readonly roles: readonly RoleAngleRecord[] }
  | { readonly ok: false; readonly message: string };

/**
 * Enregistre les rôles et leurs étiquettes.
 *
 * **Une étiquette ne peut désigner qu'un rôle**, et c'est refusé ici en nommant
 * le doublon plutôt que laissé à la contrainte d'unicité : un message Prisma
 * sur un index ne dit pas à l'utilisateur quelle ligne retirer. La contrainte
 * reste en base — elle attrape ce qu'un appel direct à l'API tenterait, et une
 * course ne la contourne pas —, mais l'écran doit pouvoir expliquer.
 *
 * Les étiquettes vides sont retirées en silence : un champ laissé blanc dans
 * une liste éditable est une ligne qu'on n'a pas remplie, pas une intention.
 */
export async function saveRoleAngles(input: RoleAnglesInput): Promise<SaveRolesResult> {
  const cleaned = input.roles.map((role) => ({
    ...role,
    labels: role.labels.filter((label) => normalizeRoleLabel(label) !== ""),
  }));

  const seen = new Map<string, string>();
  for (const role of cleaned) {
    for (const label of role.labels) {
      const key = normalizeRoleLabel(label);
      const owner = seen.get(key);
      if (owner !== undefined && owner !== role.name) {
        return {
          ok: false,
          message:
            `L'étiquette « ${label} » est déclarée pour « ${owner} » et pour « ${role.name} ». ` +
            "Une étiquette ne peut désigner qu'un rôle, sinon l'angle se choisirait au hasard.",
        };
      }
      seen.set(key, role.name);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.roleAngleLabel.deleteMany({});
    await tx.roleAngle.deleteMany({});

    for (const [index, role] of cleaned.entries()) {
      const created = await tx.roleAngle.create({
        data: { name: role.name, angle: role.angle, position: index },
        select: { id: true },
      });
      // Dédoublonnées **au sein d'un rôle** : deux fois la même étiquette sur
      // la même ligne est une maladresse de saisie, pas un conflit à signaler.
      const unique = new Map<string, string>();
      for (const label of role.labels) unique.set(normalizeRoleLabel(label), label);

      for (const [normalized, label] of unique) {
        await tx.roleAngleLabel.create({
          data: { label, normalized, roleId: created.id },
        });
      }
    }
  });

  const coverage = await readRoleCoverage();
  return { ok: true, roles: coverage.roles };
}

/**
 * L'angle qui s'applique à une fonction, prêt à entrer dans le dossier d'Alex.
 *
 * Rend **toujours** une consigne, y compris quand rien ne correspond : c'est la
 * règle du DM du jalon 48 — une absence de ligne se lit comme une absence
 * d'information, alors qu'une ligne qui dit « aucun » se lit comme une
 * interdiction.
 */
export async function angleFor(title: string): Promise<{
  readonly match: RoleMatch;
  readonly rule: string;
}> {
  const match = matchRole(title, await loadRoles());
  return { match, rule: roleAngleRule(match) };
}
