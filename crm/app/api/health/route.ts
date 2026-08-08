import { NextResponse } from "next/server";
import { readDbStatus } from "@/lib/db-status";
import { readDeployInfo } from "@/lib/deploy-info";

export const dynamic = "force-dynamic";

/**
 * Sonde de santé, destinée au healthcheck Railway.
 *
 * Contrairement à `/`, elle **échoue** quand la base ne répond pas : c'est tout
 * son intérêt comme cible de healthcheck. `/` doit au contraire répondre 200 en
 * toute circonstance pour pouvoir afficher son diagnostic.
 *
 * Trois états distincts, parce que les confondre est précisément ce qui a rendu
 * une perte de données difficile à diagnostiquer :
 *
 * - `unreachable` (503) — la base ne répond pas ;
 * - `empty` (200) — la base répond, les tables existent, aucune ligne. Ce n'est
 *   pas une panne de l'application : c'est une base jamais peuplée, ou vidée ;
 * - `ok` (200) — la base répond et contient des données.
 *
 * Aucun secret ne sort : ni URL, ni hôte, ni identifiant.
 */
export async function GET() {
  const status = await readDbStatus();
  const deploy = readDeployInfo();
  const checkedAt = new Date().toISOString();

  if (!status.ok) {
    return NextResponse.json(
      {
        status: "unreachable",
        database: { reachable: false, reason: status.diagnosis.reason },
        deploy,
        checkedAt,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    status: status.total === 0 ? "empty" : "ok",
    database: { reachable: true, counts: status.counts, total: status.total },
    deploy,
    checkedAt,
  });
}
