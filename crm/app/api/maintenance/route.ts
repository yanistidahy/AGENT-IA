import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import {
  applyLifecycleFix,
  applySearchBackfill,
  lifecycleSnapshot,
  planLifecycleFix,
  planNameFix,
  planSearchBackfill,
  applyNameFix,
  applyStatusFix,
  planStatusFix,
  statusSnapshot,
} from "@/lib/api/maintenance";
import { STATUS_CORRECTIONS } from "@/scripts/corrections-2026-08";
import {
  SHEET_MODIFIED_AT,
  SHEET_STATUSES,
  SHEET_UNREADABLE,
} from "@/scripts/statuts-2026-08";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * Corrections de données, depuis l'écran plutôt que depuis un terminal.
 *
 * Railway n'offre pas de terminal attaché au service : sans cette route, la
 * correction ne serait exécutable que par quelqu'un ayant le dépôt, la CLI et
 * l'URL de la base sous la main. Le bouton est donc le chemin **normal**, pas un
 * pis-aller — et il appelle exactement le même code que le script.
 *
 * `GET` simule et n'écrit rien. `POST` écrit, et exige de nommer l'opération :
 * une requête vide ne peut pas déclencher une écriture par accident.
 */
const OPERATIONS = ["search", "lifecycles", "names", "statuses"] as const;

const applySchema = z.object({
  operation: z.enum(OPERATIONS, { error: "Opération inconnue" }),
  /** Repris de la simulation affichée : refuse d'écrire si le plan a changé. */
  expected: z.number().int().min(0),
});

export async function GET() {
  try {
    const [search, lifecycles, names, statuses] = await Promise.all([
      planSearchBackfill(),
      planLifecycleFix(STATUS_CORRECTIONS),
      planNameFix(),
      planStatusFix(SHEET_STATUSES, SHEET_MODIFIED_AT, SHEET_UNREADABLE),
    ]);

    return jsonOk({
      search: {
        total: search.total,
        contacts: search.contacts.length,
        companies: search.companies.length,
        deals: search.deals.length,
        sample: search.contacts.slice(0, 5).map((row) => ({
          label: row.label,
          before: row.before,
          after: row.after,
        })),
      },
      names: {
        total: names.length,
        rows: names.map((row) => ({
          before: row.before,
          kept: row.kept,
          moved: row.moved,
        })),
      },
      lifecycles: {
        total: lifecycles.changes.length,
        unchanged: lifecycles.unchanged,
        uncertain: lifecycles.changes.filter((change) => change.uncertain).length,
        warnings: lifecycles.warnings,
        changes: lifecycles.changes.map((change) => ({
          label: change.label,
          from: change.from,
          to: change.lifecycle,
          lostReason: change.lostReason,
          evidence: change.evidence,
          uncertain: change.uncertain,
        })),
      },
      statuses: {
        total: statuses.changes.length,
        unchanged: statuses.unchanged,
        uncertain: statuses.changes.filter((change) => change.uncertain).length,
        conflicting: statuses.changes.filter((change) => change.conflicting).length,
        // Le point que la simulation doit dire tout haut : « Jamais contacté »
        // ne retire pas une relance programmée, et ces fiches continueront donc
        // d'apparaître dans les listes de relance.
        keepsReminder: statuses.changes.filter((change) => change.keepsReminder).length,
        byKind: {
          never: statuses.changes.filter((change) => change.kind === "never").length,
          waiting: statuses.changes.filter((change) => change.kind === "waiting").length,
          lost: statuses.changes.filter((change) => change.kind === "lost").length,
        },
        touched: statuses.touched.map((row) => row.label),
        warnings: statuses.warnings,
        changes: statuses.changes.map((change) => ({
          label: change.label,
          fromStatus: change.fromStatus,
          toStatus: change.toStatus,
          fromLifecycle: change.fromLifecycle,
          toLifecycle: change.toLifecycle,
          toReason: change.toReason,
          evidence: change.evidence,
          uncertain: change.uncertain,
          conflicting: change.conflicting,
          keepsReminder: change.keepsReminder,
        })),
      },
    });
  } catch (error) {
    return serverError("GET /api/maintenance", error);
  }
}

export async function POST(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = applySchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    if (parsed.data.operation === "search") {
      const plan = await planSearchBackfill();
      // Le plan est recalculé au moment d'écrire : si la base a bougé depuis
      // l'affichage, on refuse plutôt que d'appliquer autre chose que ce qui a
      // été validé à l'écran.
      if (plan.total !== parsed.data.expected) {
        return badRequest(
          `La base a changé depuis la simulation (${plan.total} lignes au lieu de ${parsed.data.expected}). Relancez la simulation.`,
        );
      }
      return jsonOk({ applied: await applySearchBackfill(plan) });
    }

    if (parsed.data.operation === "names") {
      const plan = await planNameFix();
      if (plan.length !== parsed.data.expected) {
        return badRequest(
          `La base a changé depuis la simulation (${plan.length} lignes au lieu de ${parsed.data.expected}). Relancez la simulation.`,
        );
      }
      return jsonOk({ applied: await applyNameFix(plan) });
    }

    if (parsed.data.operation === "statuses") {
      const plan = await planStatusFix(SHEET_STATUSES, SHEET_MODIFIED_AT, SHEET_UNREADABLE);
      if (plan.changes.length !== parsed.data.expected) {
        return badRequest(
          `La base a changé depuis la simulation (${plan.changes.length} fiches au lieu de ${parsed.data.expected}). Relancez la simulation.`,
        );
      }
      return jsonOk({
        applied: await applyStatusFix(plan, SHEET_MODIFIED_AT),
        snapshot: statusSnapshot(plan),
      });
    }

    const plan = await planLifecycleFix(STATUS_CORRECTIONS);
    if (plan.changes.length !== parsed.data.expected) {
      return badRequest(
        `La base a changé depuis la simulation (${plan.changes.length} fiches au lieu de ${parsed.data.expected}). Relancez la simulation.`,
      );
    }

    // La sauvegarde part dans la réponse : sans système de fichiers durable sur
    // le conteneur, c'est au navigateur de la conserver.
    return jsonOk({
      applied: await applyLifecycleFix(plan),
      snapshot: lifecycleSnapshot(plan),
    });
  } catch (error) {
    return serverError("POST /api/maintenance", error);
  }
}
