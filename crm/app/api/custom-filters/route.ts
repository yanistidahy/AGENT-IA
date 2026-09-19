import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import {
  addToCustomFilter,
  addToFilterSchema,
  createCustomFilter,
  createFilterSchema,
  deleteCustomFilter,
  listCustomFilters,
  removeFromCustomFilter,
  removeFromFilterSchema,
  renameCustomFilter,
  renameFilterSchema,
} from "@/lib/api/custom-filters";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * Les filtres personnalisés : lecture, création, renommage, suppression, et les
 * deux gestes d'appartenance.
 *
 * `PUT` porte l'**ajout** et `DELETE` avec un corps porte le **retrait** — ce
 * sont des opérations sur des appartenances, pas la création ni la suppression
 * du filtre lui-même, et les mêler à `POST`/`DELETE` ferait qu'une charge
 * utile mal formée puisse supprimer un filtre quand on voulait en retirer une
 * fiche. Même distinction que l'inscription de campagne (jalon 54).
 *
 * Privée par le middleware, comme tout `/api/*` depuis le jalon 9.
 */
export async function GET() {
  try {
    return jsonOk({ filters: await listCustomFilters() });
  } catch (error) {
    return serverError("GET /api/custom-filters", error);
  }
}

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return badRequest("Corps de requête JSON illisible.");

  const parsed = createFilterSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const created = await createCustomFilter(parsed.data);
    if (!created.ok) return badRequest(created.message);
    return jsonOk({ id: created.id, name: created.name, filters: await listCustomFilters() });
  } catch (error) {
    return serverError("POST /api/custom-filters", error);
  }
}

export async function PATCH(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return badRequest("Corps de requête JSON illisible.");

  const parsed = renameFilterSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const renamed = await renameCustomFilter(parsed.data);
    if (!renamed.ok) return badRequest(renamed.message);
    return jsonOk({ name: renamed.name, filters: await listCustomFilters() });
  } catch (error) {
    return serverError("PATCH /api/custom-filters", error);
  }
}

/** Ajouter des fiches à un filtre. */
export async function PUT(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return badRequest("Corps de requête JSON illisible.");

  const parsed = addToFilterSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const added = await addToCustomFilter(parsed.data);
    if (!added.ok) return badRequest(added.message);
    return jsonOk({ outcome: added.outcome });
  } catch (error) {
    return serverError("PUT /api/custom-filters", error);
  }
}

/**
 * Supprimer un filtre, ou en retirer des fiches.
 *
 * Le corps tranche : `{ contactIds }` retire des appartenances, `{ id }` seul
 * supprime le filtre. Deux routes auraient été plus explicites ; un seul verbe
 * l'est assez dès lors que le schéma distingue les deux formes, et il évite un
 * second chemin qui oublierait un jour que les fiches ne se suppriment pas.
 */
const deleteSchema = z.union([removeFromFilterSchema, z.object({ id: z.string().min(1) })]);

export async function DELETE(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return badRequest("Corps de requête JSON illisible.");

  const parsed = deleteSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    if ("contactIds" in parsed.data) {
      const removed = await removeFromCustomFilter(parsed.data);
      if (!removed.ok) return badRequest(removed.message);
      return jsonOk({ removed: removed.removed });
    }

    const deleted = await deleteCustomFilter(parsed.data.id);
    if (!deleted.ok) return badRequest(deleted.message);
    return jsonOk({ removed: deleted.removed, filters: await listCustomFilters() });
  } catch (error) {
    return serverError("DELETE /api/custom-filters", error);
  }
}
