import { z } from "zod";

/**
 * Registre d'outils.
 *
 * Chaque outil déclare son schéma Zod, sa description en français, son
 * implémentation Prisma et son `mode`. Le mode est le pivot de sécurité du
 * jalon : `read` s'exécute directement dans la boucle, `write` interrompt le
 * flux et attend un clic de l'utilisateur.
 */

export const TOOL_MODES = ["read", "write"] as const;
export type ToolMode = (typeof TOOL_MODES)[number];

/** Ce que la carte de confirmation affiche avant une écriture. */
export interface ActionSummary {
  /** Une ligne : « Créer 3 tâches pour Yanis ». */
  readonly headline: string;
  /** Détail ligne à ligne, affiché sous le titre. */
  readonly details: readonly string[];
}

export interface ToolResult {
  readonly ok: boolean;
  /** Charge utile renvoyée au modèle, sérialisée en JSON. */
  readonly data: unknown;
}

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly mode: ToolMode;
  /** Schéma JSON transmis à l'API Anthropic. */
  readonly inputSchema: Record<string, unknown>;
  /** Valide puis exécute. Une entrée invalide ne touche jamais la base. */
  readonly run: (input: unknown) => Promise<ToolResult>;
  /** Résumé pour la carte de confirmation. Écritures uniquement. */
  readonly summarize: (input: unknown) => Promise<ActionSummary>;
}

interface ToolSpec<S extends z.ZodType> {
  readonly name: string;
  readonly description: string;
  readonly mode: ToolMode;
  readonly schema: S;
  readonly run: (input: z.infer<S>) => Promise<unknown>;
  readonly summarize?: (input: z.infer<S>) => Promise<ActionSummary> | ActionSummary;
}

function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  // `io: "input"` décrit ce que le modèle doit produire, pas ce qui sort des
  // transformations — un champ date est donc annoncé comme chaîne, pas comme Date.
  const { $schema: _ignored, ...json } = z.toJSONSchema(schema, {
    target: "draft-7",
    io: "input",
  });
  // L'API attend un objet ; un schéma sans propriété doit rester un objet vide
  // plutôt que de perdre son `type`.
  return "type" in json ? json : { type: "object", properties: {}, ...json };
}

/**
 * Construit un outil typé. Le générique reste confiné à cette fonction : le
 * registre manipule des `ToolDefinition` homogènes, chaque implémentation
 * garde ses types précis.
 */
export function defineTool<S extends z.ZodType>(spec: ToolSpec<S>): ToolDefinition {
  return {
    name: spec.name,
    description: spec.description,
    mode: spec.mode,
    inputSchema: toJsonSchema(spec.schema),

    async run(input: unknown): Promise<ToolResult> {
      const parsed = spec.schema.safeParse(input);
      if (!parsed.success) {
        return {
          ok: false,
          data: {
            erreur: "Arguments invalides",
            détails: parsed.error.issues.map(
              (issue) => `${issue.path.join(".") || "(racine)"} : ${issue.message}`,
            ),
          },
        };
      }

      try {
        return { ok: true, data: await spec.run(parsed.data) };
      } catch (error) {
        console.error(`[outil ${spec.name}]`, error);
        return {
          ok: false,
          data: { erreur: "L'outil a échoué côté serveur." },
        };
      }
    },

    async summarize(input: unknown): Promise<ActionSummary> {
      const parsed = spec.schema.safeParse(input);
      if (!parsed.success) {
        return { headline: `${spec.name} — arguments invalides`, details: [] };
      }
      if (spec.summarize === undefined) {
        return { headline: spec.name, details: [JSON.stringify(parsed.data)] };
      }
      return spec.summarize(parsed.data);
    },
  };
}
