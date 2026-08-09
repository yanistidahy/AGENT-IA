import { ACTIVITY_TYPES, TASK_PRIORITIES, type ActivityType, type TaskPriority } from "@/lib/domain/types";

/**
 * Formes lues côté navigateur.
 *
 * JSON n'a pas de type date : ce que l'API renvoie est une chaîne ISO. Plutôt
 * que de faire semblant de manipuler des `Date`, ces types disent la vérité, et
 * `parseActivity` / `parseTask` font la conversion en un seul endroit, en
 * vérifiant au lieu d'affirmer.
 */

export interface ActivityView {
  readonly id: string;
  readonly type: ActivityType;
  readonly date: Date;
  readonly owner: string;
  readonly notes: string;
  readonly duration: number | null;
  readonly contactName: string | null;
  readonly companyName: string | null;
  readonly dealName: string | null;
}

export interface TaskView {
  readonly id: string;
  readonly title: string;
  readonly due: Date;
  readonly priority: TaskPriority;
  readonly owner: string;
  readonly done: boolean;
  readonly target: { readonly label: string; readonly href: string } | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  return { ...value };
}

function str(bag: Record<string, unknown>, key: string): string {
  const value = bag[key];
  return typeof value === "string" ? value : "";
}

function date(bag: Record<string, unknown>, key: string): Date | null {
  const value = bag[key];
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function activityType(value: string): ActivityType {
  return ACTIVITY_TYPES.find((candidate) => candidate === value) ?? "note";
}

function taskPriority(value: string): TaskPriority {
  return TASK_PRIORITIES.find((candidate) => candidate === value) ?? "normale";
}

/** Nom lisible d'une relation jointe, ou `null` si elle est absente. */
function relationName(bag: Record<string, unknown>, key: string, fields: readonly string[]): string | null {
  const relation = asRecord(bag[key]);
  if (relation === null) return null;
  const parts = fields.map((field) => str(relation, field)).filter((part) => part !== "");
  return parts.length === 0 ? null : parts.join(" ");
}

export function parseActivity(value: unknown): ActivityView | null {
  const bag = asRecord(value);
  if (bag === null) return null;

  const id = str(bag, "id");
  const when = date(bag, "date");
  if (id === "" || when === null) return null;

  const duration = bag.duration;

  return {
    id,
    date: when,
    type: activityType(str(bag, "type")),
    owner: str(bag, "owner"),
    notes: str(bag, "notes"),
    duration: typeof duration === "number" ? duration : null,
    contactName: relationName(bag, "contact", ["firstName", "lastName"]),
    companyName: relationName(bag, "company", ["name"]),
    dealName: relationName(bag, "deal", ["name"]),
  };
}

export function parseTask(value: unknown): TaskView | null {
  const bag = asRecord(value);
  if (bag === null) return null;

  const id = str(bag, "id");
  const due = date(bag, "due");
  if (id === "" || due === null) return null;

  const target = asRecord(bag.target);

  return {
    id,
    due,
    title: str(bag, "title"),
    priority: taskPriority(str(bag, "priority")),
    owner: str(bag, "owner"),
    done: bag.done === true,
    target:
      target === null
        ? null
        : { label: str(target, "label"), href: str(target, "href") },
  };
}

/** Extrait et convertit une liste, en écartant les entrées illisibles. */
export function parseList<T>(
  payload: unknown,
  key: string,
  parse: (value: unknown) => T | null,
): T[] {
  const bag = asRecord(payload);
  if (bag === null) return [];
  const list = bag[key];
  if (!Array.isArray(list)) return [];

  const out: T[] = [];
  for (const item of list) {
    const parsed = parse(item);
    if (parsed !== null) out.push(parsed);
  }
  return out;
}
