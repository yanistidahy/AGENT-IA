import { NextResponse } from "next/server";
import { describeUptime, readDeployInfo } from "@/lib/deploy-info";

export const dynamic = "force-dynamic";

/**
 * **Quel code sert les requêtes**, en une URL.
 *
 * Le pied de page de `/` et le bloc de `/reglages` disent la même chose ; celle-ci
 * existe pour pouvoir le vérifier **sans naviguer** — un onglet, un coup d'œil,
 * et la comparaison avec la tête de `main` est faite.
 *
 * **Elle n'est pas publique**, et c'est délibéré : le middleware ferme tout ce
 * qui n'est pas dans `PUBLIC_PATHS`, donc cette route demande une session comme
 * le reste. C'est la règle posée au jalon 9 quand la sonde publique a été rendue
 * muette — l'identité d'un déploiement (branche, commit, environnement) renseigne
 * un tiers sur le rythme de livraison et sur la structure du dépôt. La question
 * « quel code tourne » est une question d'exploitation, pas une question publique.
 *
 * `no-store` : une réponse mise en cache par un intermédiaire répondrait un jour
 * l'ancien commit, ce qui recréerait exactement l'ambiguïté que cette route sert
 * à supprimer.
 */
export async function GET() {
  const deploy = readDeployInfo();
  const now = new Date();

  return NextResponse.json(
    {
      commit: deploy.commitFull,
      commitShort: deploy.commit,
      branch: deploy.branch,
      service: deploy.service,
      environment: deploy.environment,
      deploymentId: deploy.deploymentId,
      startedAt: deploy.startedAt.toISOString(),
      uptime: describeUptime(deploy.startedAt, now),
      checkedAt: now.toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
