import { jsonOk, serverError } from "@/lib/api/errors";
import { runDiagnostic } from "@/lib/agents/runtime/diagnostic";
import { DEFAULT_AGENT_SLUG, findAgent } from "@/lib/agents/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Test de connexion à l'API Anthropic.
 *
 * `POST` et non `GET` : la route consomme des jetons, si peu que ce soit. Une
 * route qui dépense de l'argent ne doit pas répondre à une requête qu'un
 * préchargement de navigateur peut déclencher tout seul.
 */
export async function POST(request: Request) {
  try {
    const slug = new URL(request.url).searchParams.get("agent") ?? DEFAULT_AGENT_SLUG;
    const target = findAgent(slug) === undefined ? DEFAULT_AGENT_SLUG : slug;
    return jsonOk(await runDiagnostic(target));
  } catch (error) {
    return serverError("POST /api/agents/diagnostic", error);
  }
}
