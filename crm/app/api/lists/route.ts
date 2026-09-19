import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import {
  addToContactList,
  addToListSchema,
  createContactList,
  createListSchema,
  deleteContactList,
  listContactLists,
  removeFromContactList,
  removeFromListSchema,
  renameContactList,
  renameListSchema,
} from "@/lib/api/contact-lists";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * Les listes de contacts : lecture, création, renommage, suppression, et les
 * deux gestes d'appartenance.
 *
 * `PUT` porte l'**ajout** et `DELETE` avec un corps porte le **retrait** — ce
 * sont des opérations sur des appartenances, pas la création ni la suppression
 * de la liste elle-même, et les mêler à `POST`/`DELETE` ferait qu'une charge
 * utile mal formée puisse supprimer une liste quand on voulait en retirer une
 * fiche. Même distinction que l'inscription de campagne (jalon 54).
 *
 * Privée par le middleware, comme tout `/api/*` depuis le jalon 9.
 */
export async function GET() {
  try {
    return jsonOk({ lists: await listContactLists() });
  } catch (error) {
    return serverError("GET /api/lists", error);
  }
}

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return badRequest("Corps de requête JSON illisible.");

  const parsed = createListSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const created = await createContactList(parsed.data);
    if (!created.ok) return badRequest(created.message);
    return jsonOk({ id: created.id, name: created.name, lists: await listContactLists() });
  } catch (error) {
    return serverError("POST /api/lists", error);
  }
}

export async function PATCH(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return badRequest("Corps de requête JSON illisible.");

  const parsed = renameListSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const renamed = await renameContactList(parsed.data);
    if (!renamed.ok) return badRequest(renamed.message);
    return jsonOk({ name: renamed.name, lists: await listContactLists() });
  } catch (error) {
    return serverError("PATCH /api/lists", error);
  }
}

/** Ajouter des fiches à une liste. */
export async function PUT(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return badRequest("Corps de requête JSON illisible.");

  const parsed = addToListSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const added = await addToContactList(parsed.data);
    if (!added.ok) return badRequest(added.message);
    return jsonOk({ outcome: added.outcome });
  } catch (error) {
    return serverError("PUT /api/lists", error);
  }
}

/**
 * Supprimer une liste, ou en retirer des fiches.
 *
 * Le corps tranche : `{ contactIds }` retire des appartenances, `{ id }` seul
 * supprime la liste. Deux routes auraient été plus explicites ; un seul verbe
 * l'est assez dès lors que le schéma distingue les deux formes, et il évite un
 * second chemin qui oublierait un jour que les fiches ne se suppriment pas.
 */
const deleteSchema = z.union([
  removeFromListSchema,
  z.object({ id: z.string().min(1) }),
]);

export async function DELETE(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return badRequest("Corps de requête JSON illisible.");

  const parsed = deleteSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    if ("contactIds" in parsed.data) {
      const removed = await removeFromContactList(parsed.data);
      if (!removed.ok) return badRequest(removed.message);
      return jsonOk({ removed: removed.removed });
    }

    const deleted = await deleteContactList(parsed.data.id);
    if (!deleted.ok) return badRequest(deleted.message);
    return jsonOk({ removed: deleted.removed, lists: await listContactLists() });
  } catch (error) {
    return serverError("DELETE /api/lists", error);
  }
}
