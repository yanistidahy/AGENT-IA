import { z } from "zod";
import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { listSnapshotRuns, listSnapshots, restoreSnapshot, takeSnapshot } from "@/lib/api/snapshots";
import { snapshotHealth } from "@/lib/api/snapshots";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  try {
    const [listing, runs, health] = await Promise.all([
      listSnapshots(),
      listSnapshotRuns(),
      snapshotHealth(),
    ]);
    return jsonOk({ ...listing, runs, health });
  } catch (error) {
    return serverError("GET /api/snapshots", error);
  }
}

const actionSchema = z.union([
  z.object({ action: z.literal("take") }),
  z.object({ action: z.literal("restore"), key: z.string().trim().min(1) }),
]);

export async function POST(request: Request) {
  try {
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) return invalidPayload(parsed.error);

    if (parsed.data.action === "take") {
      const result = await takeSnapshot({ manual: true });
      if (!result.ok) return badRequest(result.message);
      return jsonOk(result);
    }

    const result = await restoreSnapshot(parsed.data.key);
    if (!result.ok) return badRequest(result.message);
    return jsonOk(result);
  } catch (error) {
    return serverError("POST /api/snapshots", error);
  }
}
