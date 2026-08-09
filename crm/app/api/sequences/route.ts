import { jsonOk, serverError } from "@/lib/api/errors";
import { listSequences } from "@/lib/api/sequences";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sequences = await listSequences();
    return jsonOk({ sequences, total: sequences.length });
  } catch (error) {
    return serverError("GET /api/sequences", error);
  }
}
