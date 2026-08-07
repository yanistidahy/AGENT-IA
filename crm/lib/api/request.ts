/**
 * Lecture du corps JSON d'une requête.
 *
 * Un corps absent ou malformé est une erreur de client, pas une panne serveur :
 * on le distingue explicitement plutôt que de laisser remonter l'exception de
 * `request.json()` jusqu'au gestionnaire d'erreur générique.
 */
export type JsonBody =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false };

export async function readJson(request: Request): Promise<JsonBody> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false };
  }
}
