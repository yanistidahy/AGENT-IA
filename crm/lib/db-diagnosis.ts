/**
 * Traduction des erreurs Prisma en diagnostic actionnable.
 *
 * Module volontairement pur — aucune importation de Prisma — pour être testable
 * sans base ni client généré.
 *
 * Deux formes d'erreur coexistent et ne se lisent pas de la même façon :
 * `PrismaClientKnownRequestError` porte son code dans `.code`, tandis que
 * `PrismaClientInitializationError` déclare un champ `errorCode` qui reste
 * `undefined` sur une panne de connexion — le code n'apparaît alors que dans le
 * texte du message, voire pas du tout.
 */

export interface Diagnosis {
  readonly reason: string;
  readonly hint: string;
}

export function errorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;

  if ("code" in error && typeof error.code === "string") return error.code;
  if ("errorCode" in error && typeof error.errorCode === "string") {
    return error.errorCode;
  }

  if ("message" in error && typeof error.message === "string") {
    const message = error.message;

    const explicit = /\bP\d{4}\b/.exec(message);
    if (explicit !== null) return explicit[0] ?? null;

    // Motifs de repli, quand le code n'est présent nulle part.
    if (message.includes("Can't reach database server")) return "P1001";
    if (message.includes("Authentication failed")) return "P1000";
    if (message.includes("does not exist on the database server")) return "P1003";
  }

  return null;
}

export function diagnose(error: unknown): Diagnosis {
  switch (errorCode(error)) {
    case "P1000":
      return {
        reason: "Authentification refusée par PostgreSQL",
        hint: "Les identifiants de DATABASE_URL ne sont pas les bons. Préférez une référence de variable vers le service Postgres à une URL copiée à la main.",
      };
    case "P1001":
    case "P1002":
      return {
        reason: "Serveur PostgreSQL injoignable",
        hint: "Vérifiez que le service Postgres est démarré et que DATABASE_URL pointe vers son hôte interne, joignable depuis ce service.",
      };
    case "P1003":
      return {
        reason: "La base indiquée n'existe pas",
        hint: "Le nom de base présent dans DATABASE_URL ne correspond à aucune base sur ce serveur.",
      };
    case "P2021":
    case "P2022":
      return {
        reason: "Tables absentes — migrations non appliquées",
        hint: "La connexion fonctionne mais le schéma est vide. Consultez les Deploy Logs : « prisma migrate deploy » a échoué au démarrage.",
      };
    default:
      return {
        reason:
          error instanceof Error ? error.name : "Erreur inconnue à la connexion",
        hint: "Consultez les Deploy Logs du service pour le détail.",
      };
  }
}
