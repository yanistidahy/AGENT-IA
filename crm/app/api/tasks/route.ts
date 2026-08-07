import type { NextRequest } from "next/server";
import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { createTaskSchema, parseTasksQuery } from "@/lib/api/task-schemas";
import { createTask, listTasks } from "@/lib/api/tasks";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = parseTasksQuery(request.nextUrl.searchParams);
  if (!query.success) return invalidPayload(query.error);

  try {
    const tasks = await listTasks(query.data);
    return jsonOk({ tasks, total: tasks.length });
  } catch (error) {
    return serverError("GET /api/tasks", error);
  }
}

export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = createTaskSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const task = await createTask(parsed.data);
    return jsonOk({ task }, 201);
  } catch (error) {
    return serverError("POST /api/tasks", error);
  }
}
