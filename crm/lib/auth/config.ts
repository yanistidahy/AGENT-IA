/**
 * Configuration du verrou d'espace de travail.
 *
 * Tout le module `lib/auth/` est délibérément isolé : il ne connaît ni Prisma,
 * ni les écrans, ni le domaine. Le reste de l'application ne l'appelle qu'à
 * travers `middleware.ts` et les deux routes `/api/auth/*`. Le remplacer plus
 * tard par de vrais comptes, des rôles ou OAuth ne demandera de toucher aucun
 * autre fichier — c'est la contrainte que le mot de passe partagé achète.
 */

/** Nom du cookie de session. Préfixe `__Host-` volontairement écarté : voir plus bas. */
export const SESSION_COOKIE = "auraflow_session";

/** Durée de vie d'une session, en secondes. 30 jours. */
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * Chemins accessibles sans session.
 *
 * Liste **fermée** et volontairement minuscule. Tout le reste — pages, `/api/*`,
 * exports CSV, sauvegarde JSON — est protégé par défaut : c'est l'inverse d'une
 * liste de chemins à protéger, qui laisse passer toute route ajoutée ensuite et
 * oubliée. Une route nouvelle est privée tant que personne ne l'ouvre ici
 * explicitement.
 *
 * `/api/health` reste public parce que le healthcheck Railway l'interroge sans
 * cookie ; il ne renvoie plus aucune donnée (voir `app/api/health/route.ts`).
 */
export const PUBLIC_PATHS: readonly string[] = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/health",
];

/** Ressources servies par Next lui-même, jamais porteuses de données métier. */
const PUBLIC_PREFIXES: readonly string[] = ["/_next/", "/favicon", "/fonts/"];

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Le mot de passe attendu, ou `null` s'il n'est pas configuré.
 *
 * L'absence de variable **ferme** l'application au lieu de l'ouvrir. Une
 * configuration manquante qui laisserait tout passer est exactement le défaut
 * qu'on est en train de corriger : un CRM lisible par n'importe qui parce qu'une
 * variable d'environnement manquait.
 */
export function workspacePassword(): string | null {
  const value = process.env.WORKSPACE_PASSWORD;
  if (typeof value !== "string" || value.trim() === "") return null;
  return value;
}

/**
 * Le cookie est marqué `Secure` en production seulement.
 *
 * En développement l'application tourne en clair sur `localhost` ; un cookie
 * `Secure` n'y serait jamais renvoyé et le verrou paraîtrait cassé alors qu'il
 * fonctionne. En production, Railway sert exclusivement en HTTPS.
 */
export function cookieOptions(maxAge: number = SESSION_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  } as const;
}
