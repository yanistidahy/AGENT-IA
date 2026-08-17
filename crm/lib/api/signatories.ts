import "server-only";
import { z } from "zod";
import { prisma } from "../db";
import { signatureBlock } from "../agents/prompts/company";

/**
 * Les personnes qui peuvent signer un email.
 *
 * Deux personnes envoient depuis ce CRM ; le couple « nom / titre » unique du
 * jalon 34 ne savait en décrire qu'une. **Le signataire n'est pas un réglage
 * global mais une propriété de l'envoi** : il se choisit message par message,
 * dans le panneau de rédaction.
 */
export interface Signatory {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly isDefault: boolean;
}

export async function listSignatories(): Promise<Signatory[]> {
  const rows = await prisma.signatory.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true, title: true, isDefault: true },
  });
  return rows;
}

/**
 * Le signataire proposé pour un contact donné.
 *
 * **Le propriétaire de la fiche d'abord.** Si « Yanis » suit ce prospect, c'est
 * lui qui écrit : proposer systématiquement le signataire par défaut ferait
 * partir la moitié des messages sous la mauvaise identité, et l'erreur ne se
 * verrait qu'à la réception.
 *
 * La correspondance est volontairement souple — le propriétaire d'une fiche est
 * un prénom (« Yanis »), le signataire un nom complet (« Yanis Tidahy ») — mais
 * elle reste ancrée : on compare des mots entiers, pour que « Marc » ne
 * corresponde pas à « Marceau ».
 */
export function pickSignatory(
  signatories: readonly Signatory[],
  owner: string,
): Signatory | null {
  if (signatories.length === 0) return null;

  const needle = owner.trim().toLowerCase();
  if (needle !== "") {
    const match = signatories.find((signatory) => {
      const words = signatory.name.toLowerCase().split(/\s+/);
      return signatory.name.toLowerCase() === needle || words.includes(needle);
    });
    if (match !== undefined) return match;
  }

  return signatories.find((signatory) => signatory.isDefault) ?? signatories[0] ?? null;
}

/** Tous les blocs de signature connus — ce que `replaceSignature` cherche. */
export function signatureBlocks(signatories: readonly Signatory[]): string[] {
  return signatories.map((signatory) => signatureBlock(signatory));
}

/**
 * Les noms qui ne doivent jamais clore un email écrit pour quelqu'un d'autre.
 *
 * **Chaque signataire y figure**, en plus des agents : un brouillon destiné à
 * partir sous le nom de Mohamed ne doit pas se terminer par celui de Yanis. Le
 * nom complet et le prénom seul, parce qu'on signe rarement de son nom entier.
 */
export function signatoryNames(signatories: readonly Signatory[]): string[] {
  const names = new Set<string>();
  for (const signatory of signatories) {
    const full = signatory.name.trim();
    if (full === "") continue;
    names.add(full);
    const first = full.split(/\s+/)[0] ?? "";
    if (first !== "") names.add(first);
  }
  return [...names];
}

export const signatoriesSchema = z.object({
  signatories: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().trim().min(1, "Le nom ne peut pas être vide").max(80),
        title: z.string().trim().max(120),
        isDefault: z.boolean(),
      }),
    )
    .min(1, "Il faut au moins un signataire")
    .max(10),
});

export type SignatoriesInput = z.infer<typeof signatoriesSchema>;

/**
 * Enregistre la liste, en garantissant **exactement un** défaut.
 *
 * Zéro défaut laisserait `pickSignatory()` retomber sur le premier de la liste,
 * donc sur l'ordre d'affichage — un choix implicite que personne n'a fait. Deux
 * défauts poseraient la même question sans réponse. La règle est appliquée ici
 * plutôt qu'espérée de l'écran, parce que l'API est aussi appelable directement.
 */
export async function saveSignatories(input: SignatoriesInput): Promise<Signatory[]> {
  const wanted = input.signatories;
  const firstDefault = wanted.findIndex((signatory) => signatory.isDefault);
  const defaultIndex = firstDefault === -1 ? 0 : firstDefault;

  await prisma.$transaction(async (tx) => {
    await tx.signatory.deleteMany({});
    for (const [index, signatory] of wanted.entries()) {
      await tx.signatory.create({
        data: {
          name: signatory.name,
          title: signatory.title,
          isDefault: index === defaultIndex,
          position: index,
        },
      });
    }
  });

  return listSignatories();
}
