/**
 * Constantes du rail, hors de tout composant client.
 *
 * `rail.tsx` porte `"use client"` : tout ce qu'il exporte devient une
 * *référence client* quand un composant serveur l'importe — le layout
 * recevait donc autre chose que la chaîne `"rail"`, `cookies().get()` ne
 * trouvait rien, et l'état replié ne survivait pas au rechargement. Les
 * valeurs partagées entre les deux mondes vivent ici, sans directive.
 */
export const RAIL_COOKIE = "rail";

/** Demande à la palette Ctrl+K de s'ouvrir — le doigt n'a pas de Ctrl+K. */
export const SEARCH_EVENT = "aura:search";
