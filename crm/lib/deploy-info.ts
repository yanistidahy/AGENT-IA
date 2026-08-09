/**
 * Identité du déploiement en cours.
 *
 * Railway injecte ces variables dans le conteneur. Les afficher permet de
 * vérifier d'un coup d'œil *quel commit* sert réellement les requêtes, sans
 * avoir à croire l'interface sur parole — un déploiement peut servir un tout
 * autre code que celui qu'on croit avoir poussé.
 */

export interface DeployInfo {
  readonly commit: string | null;
  readonly branch: string | null;
  readonly service: string | null;
}

function nonEmpty(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function readDeployInfo(): DeployInfo {
  const commit = nonEmpty(process.env.RAILWAY_GIT_COMMIT_SHA);
  return {
    commit: commit === null ? null : commit.slice(0, 7),
    branch: nonEmpty(process.env.RAILWAY_GIT_BRANCH),
    service: nonEmpty(process.env.RAILWAY_SERVICE_NAME),
  };
}
