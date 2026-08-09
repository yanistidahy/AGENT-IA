import { jsonOk, serverError } from "@/lib/api/errors";
import { listAgentProfiles } from "@/lib/api/agents";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return jsonOk({ agents: await listAgentProfiles() });
  } catch (error) {
    return serverError("GET /api/agents", error);
  }
}
