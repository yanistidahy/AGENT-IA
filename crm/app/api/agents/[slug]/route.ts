import { badRequest, invalidPayload, jsonOk, notFound, serverError } from "@/lib/api/errors";
import { findAgentProfile, updateAgent, updateAgentSchema } from "@/lib/api/agents";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const agent = await findAgentProfile(slug);
    if (agent === null) return notFound("Agent inconnu.");
    return jsonOk({ agent });
  } catch (error) {
    return serverError("GET /api/agents/[slug]", error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const parsed = updateAgentSchema.safeParse(await request.json());
    if (!parsed.success) return invalidPayload(parsed.error);

    const result = await updateAgent(slug, parsed.data);
    if (!result.ok) return badRequest(result.message);
    return jsonOk({ agent: result.agent });
  } catch (error) {
    return serverError("PATCH /api/agents/[slug]", error);
  }
}
