/**
 * Destination après connexion.
 *
 * Un paramètre `?next=` recopié tel quel dans une redirection fait de la page de
 * connexion un tremplin : `?next=https://exemple-malveillant/` enverrait
 * ailleurs quelqu'un qui vient pourtant de saisir son mot de passe sur le bon
 * domaine. Seul un chemin **relatif à la racine** est accepté.
 *
 * `//ailleurs` est refusé explicitement : le navigateur le lit comme une URL
 * absolue vers un autre hôte, alors qu'il commence bien par une barre oblique.
 */
export function safeNext(value: string | null | undefined, fallback = "/"): string {
  if (typeof value !== "string" || value === "") return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  // `\` est réécrit en `/` par certains navigateurs : `/\ailleurs` deviendrait
  // `//ailleurs`, donc une URL absolue.
  if (value.includes("\\")) return fallback;
  return value;
}
