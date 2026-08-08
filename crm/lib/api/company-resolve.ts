import type { Prisma } from "@prisma/client";

/**
 * Résolution d'une société nommée à la volée.
 *
 * Le cas d'usage est celui du terrain : on découvre la personne et sa société au
 * même moment. Le formulaire envoie donc `companyName` au lieu de `companyId`,
 * et la société est créée **dans la même transaction** que le contact ou
 * l'affaire — sinon un échec à la seconde écriture laisserait une société
 * orpheline que personne n'a demandée.
 *
 * La comparaison est insensible à la casse **et aux accents**, et elle se fait
 * en mémoire plutôt qu'en SQL. Deux raisons : `mode: "insensitive"` ne couvre
 * pas les accents, et surtout il n'existe pas sous SQLite — le comportement
 * serait alors invérifiable hors production, ce qui est précisément la façon
 * dont un doublon « ACME » / « acme » finit par arriver en base sans que
 * personne l'ait vu venir. La table des sociétés se compte en dizaines : la
 * lire entièrement coûte moins qu'une règle qu'on ne peut pas tester.
 */
export type TransactionClient = Prisma.TransactionClient;

/** Minuscules, sans accents : « Zénith » et « ZENITH » désignent la même société. */
export function normalizeCompanyName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export async function resolveCompanyByName(
  tx: TransactionClient,
  name: string,
): Promise<string> {
  const trimmed = name.trim();
  const needle = normalizeCompanyName(trimmed);

  const candidates = await tx.company.findMany({ select: { id: true, name: true } });
  const existing = candidates.find(
    (company) => normalizeCompanyName(company.name) === needle,
  );
  if (existing !== undefined) return existing.id;

  // Le nom seul : le reste de la fiche se remplit depuis son propre tiroir.
  const created = await tx.company.create({ data: { name: trimmed }, select: { id: true } });
  return created.id;
}

/**
 * Rattachement demandé par un formulaire.
 *
 * `companyName` l'emporte sur `companyId` quand les deux sont présents : c'est
 * ce que l'utilisateur vient de taper qui fait foi, pas la valeur restée dans
 * l'état du composant.
 */
export interface CompanyLinkInput {
  readonly companyId?: string | null | undefined;
  readonly companyName?: string | undefined;
}

export async function resolveCompanyLink(
  tx: TransactionClient,
  input: CompanyLinkInput,
): Promise<string | null | undefined> {
  const name = input.companyName?.trim();
  if (name !== undefined && name !== "") return resolveCompanyByName(tx, name);
  return input.companyId;
}
