/**
 * Identité du déploiement en cours.
 *
 * Railway injecte ces variables dans le conteneur. Les afficher permet de
 * vérifier d'un coup d'œil *quel commit* sert réellement les requêtes, sans
 * avoir à croire l'interface sur parole — un déploiement peut servir un tout
 * autre code que celui qu'on croit avoir poussé.
 *
 * ## Pourquoi ce module a été étoffé au jalon 51
 *
 * Le pied de page ne portait que le commit sur sept caractères. Il manquait
 * **depuis quand** ce code sert les requêtes, et c'est exactement l'information
 * qui départage les deux causes qu'on a confondues deux fois de suite :
 *
 * - `main` fusionné mais un déploiement plus ancien encore en ligne — un échec
 *   de déploiement laisse tourner le précédent, sans que rien ne le dise ;
 * - `main` fusionné, déploiement à jour, et un vrai défaut d'affichage.
 *
 * Les deux se ressemblent parfaitement à l'écran. Un commit **et** une date de
 * démarrage les séparent en une seconde, et c'est tout l'objet de ce module.
 */

/**
 * L'instant où **ce processus** a démarré.
 *
 * C'est le fait le plus proche de « quand ce déploiement est-il parti » dont on
 * dispose de source sûre : Railway n'injecte aucune variable d'horodatage de
 * déploiement, et une date figée au build mentirait après un redémarrage du
 * conteneur — or c'est précisément le cas qu'on cherche à distinguer.
 *
 * Calculé **une fois à l'import** : `process.uptime()` avance, et un instant de
 * démarrage recalculé à chaque requête donnerait la même valeur à quelques
 * millisecondes près, ce qui suffirait à faire douter d'un affichage stable.
 */
const STARTED_AT = new Date(Date.now() - process.uptime() * 1000);

export interface DeployInfo {
  /** Le commit sur sept caractères — ce qu'on compare d'un coup d'œil. */
  readonly commit: string | null;
  /** Le commit entier, pour une comparaison sans ambiguïté au copier-coller. */
  readonly commitFull: string | null;
  readonly branch: string | null;
  readonly service: string | null;
  readonly environment: string | null;
  /**
   * L'identifiant du déploiement Railway.
   *
   * Il change à **chaque** déploiement, même à commit identique : c'est ce qui
   * permet de dire « j'ai bien redéployé » quand rien n'a été poussé entre-temps.
   */
  readonly deploymentId: string | null;
  /** Depuis quand ce processus sert les requêtes. */
  readonly startedAt: Date;
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
    commitFull: commit,
    branch: nonEmpty(process.env.RAILWAY_GIT_BRANCH),
    service: nonEmpty(process.env.RAILWAY_SERVICE_NAME),
    environment: nonEmpty(process.env.RAILWAY_ENVIRONMENT_NAME),
    deploymentId: nonEmpty(process.env.RAILWAY_DEPLOYMENT_ID),
    startedAt: STARTED_AT,
  };
}

/**
 * Depuis combien de temps ce code sert les requêtes, en une phrase.
 *
 * L'âge dit plus que la date brute : « démarré il y a 16 heures » à côté d'une
 * fusion faite il y a dix minutes **est** le diagnostic, sans avoir à soustraire
 * deux horodatages de tête.
 */
export function describeUptime(startedAt: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - startedAt.getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}
