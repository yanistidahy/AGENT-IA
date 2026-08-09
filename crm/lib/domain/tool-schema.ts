/**
 * Contraintes de l'API Anthropic sur la forme d'un outil — la part pure.
 *
 * Ce module ne connaît ni le registre d'outils, ni Zod, ni le SDK : il prend un
 * nom et un schéma JSON et dit ce qui ne va pas. C'est ce qui lui permet d'être
 * appelé aussi bien par le test de garde que par le serveur de substitution des
 * vérifications locales — un doublon de règle entre les deux serait précisément
 * la faille qui a laissé passer l'incident.
 */

/**
 * Motif imposé par l'API aux **noms d'outils** et aux **clés de `properties`**.
 *
 * Établi en production, pas déduit : un envoi réel a été refusé avec
 * « Property keys should match pattern '^[a-zA-Z0-9_.-]{1,64}$' ». Ni accent,
 * ni espace, ni apostrophe — ce qui exclut le français dans les identifiants.
 */
export const TOOL_KEY_PATTERN = /^[a-zA-Z0-9_.-]{1,64}$/;

export interface SchemaViolation {
  /** Où, en notation pointée, depuis la racine du schéma. */
  readonly path: string;
  readonly key: string;
  readonly reason: string;
}

/**
 * Toutes les clés de `properties` fautives, **à tous les niveaux**.
 *
 * La contrainte porte sur chaque bloc `properties`, pas seulement celui de la
 * racine : un objet imbriqué dans une propriété est validé pareil. On descend
 * donc dans tout l'arbre, tableaux compris (`anyOf`, `items`…).
 */
export function findKeyViolations(schema: unknown, path = ""): SchemaViolation[] {
  const found: SchemaViolation[] = [];

  const walk = (node: unknown, here: string): void => {
    if (Array.isArray(node)) {
      node.forEach((entry, index) => walk(entry, `${here}[${index}]`));
      return;
    }
    if (typeof node !== "object" || node === null) return;

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === "properties" && typeof value === "object" && value !== null && !Array.isArray(value)) {
        for (const property of Object.keys(value as Record<string, unknown>)) {
          if (!TOOL_KEY_PATTERN.test(property)) {
            found.push({
              path: `${here}.properties`,
              key: property,
              reason: "clé de propriété hors du motif autorisé",
            });
          }
        }
      }
      walk(value, `${here}.${key}`);
    }
  };

  walk(schema, path);
  return found;
}

/** Le nom de l'outil est soumis au même motif que les clés. */
export function findNameViolation(name: string): SchemaViolation | null {
  if (TOOL_KEY_PATTERN.test(name)) return null;
  return { path: "name", key: name, reason: "nom d'outil hors du motif autorisé" };
}

/** Tout ce que l'API refuserait dans cet outil. Vide = acceptable. */
export function inspectTool(name: string, schema: unknown): SchemaViolation[] {
  const nameIssue = findNameViolation(name);
  return [...(nameIssue === null ? [] : [nameIssue]), ...findKeyViolations(schema)];
}

/** Message d'une violation, lisible dans une sortie de test ou un journal. */
export function describeViolation(toolName: string, violation: SchemaViolation): string {
  return `${toolName} → ${violation.path}.${violation.key} : ${violation.reason} (motif ${TOOL_KEY_PATTERN.source})`;
}
