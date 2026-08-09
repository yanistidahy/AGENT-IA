import { badRequest, invalidPayload, jsonOk, notFound, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { updateTaskSchema } from "@/lib/api/task-schemas";
import { deleteTask, getTask, updateTask } from "@/lib/api/tasks";

export const dynamic = "force-dynamic";

interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const task = await getTask(id);
    if (task === null) return notFound("Tâche introuvable.");
    return jsonOk({ task });
  } catch (error) {
    return serverError(`GET /api/tasks/${id}`, error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = updateTaskSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const task = await updateTask(id, parsed.data);
    if (task === null) return notFound("Tâche introuvable.");
    return jsonOk({ task });
  } catch (error) {
    return serverError(`PATCH /api/tasks/${id}`, error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const removed = await deleteTask(id);
    if (!removed) return notFound("Tâche introuvable.");
    return jsonOk({ deleted: id });
  } catch (error) {
    return serverError(`DELETE /api/tasks/${id}`, error);
  }
}
