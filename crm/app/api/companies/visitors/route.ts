import type { NextRequest } from "next/server";
import { importVisitors } from "@/lib/api/companies";
import { importVisitorsSchema } from "@/lib/api/company-schemas";
import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";

export const dynamic = "force-dynamic";

/**
 * **Le collage de trafics : une seule route, deux usages.**
 *
 * `apply: false` (le défaut) simule et rend le rapport ; `apply: true` écrit les
 * seules lignes que le rapport annonçait en mise à jour. **Deux routes auraient
 * fini par rapprocher différemment**, et le rapport affiché n'aurait alors plus
 * rien garanti de ce qui s'écrit — c'est le motif de `/api/maintenance` depuis
 * le jalon 12.
 *
 * `POST` dans les deux cas, simulation comprise : le corps porte un collage de
 * plusieurs milliers de caractères, qu'une URL ne transporte pas.
 *
 * Elle **ne crée aucune société**, et ce n'est pas une promesse de commentaire :
 * `importVisitors` n'écrit que par `update` sur un `id` lu en base.
 */
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = importVisitorsSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const report = await importVisitors(parsed.data);
    return jsonOk({ report });
  } catch (error) {
    return serverError("POST /api/companies/visitors", error);
  }
}
