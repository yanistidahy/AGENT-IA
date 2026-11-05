import { NextResponse } from "next/server";
import { backupSchema, exportBackup, restoreBackup } from "@/lib/api/backup";
import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";

export const dynamic = "force-dynamic";

/** Sauvegarde complète, téléchargée en JSON. */
export async function GET() {
  try {
    const backup = await exportBackup();
    const day = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="auraflow-crm-${day}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return serverError("GET /api/backup", error);
  }
}

/** Restauration : remplace tout, ou ne touche à rien. */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Fichier JSON illisible.");

  const parsed = backupSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const result = await restoreBackup(parsed.data);
    if (!result.ok) return badRequest(result.message);
    // `skipped` et `warnings` remontent jusqu'à l'écran : une ligne qu'une
    // restauration n'a pas su replacer se dit, elle ne se devine pas.
    return jsonOk({
      counts: result.counts,
      skipped: result.skipped,
      warnings: result.warnings,
    });
  } catch (error) {
    return serverError("POST /api/backup", error);
  }
}
