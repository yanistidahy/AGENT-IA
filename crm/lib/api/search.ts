import { prisma } from "../db";
import { contactTitle } from "../domain/contact-identity";

/**
 * Recherche transverse pour la palette Ctrl+K.
 *
 * Quatre requêtes en parallèle plutôt qu'une union SQL : les entités n'ont ni
 * les mêmes colonnes ni les mêmes libellés, et Prisma ne sait pas les unir sans
 * requête brute — qui coûterait la portabilité du schéma pour un gain nul à ce
 * volume.
 *
 * `mode: "insensitive"` est propre à PostgreSQL — voir CLAUDE.md § Base de données.
 */
export type SearchKind = "contact" | "company" | "deal" | "task";

export interface SearchHit {
  readonly kind: SearchKind;
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly href: string;
}

const PER_KIND = 5;

export async function search(query: string): Promise<SearchHit[]> {
  const term = query.trim();
  if (term.length < 2) return [];

  const contains = { contains: term, mode: "insensitive" as const };

  const [contacts, companies, deals, tasks] = await Promise.all([
    prisma.contact.findMany({
      where: {
        OR: [{ firstName: contains }, { lastName: contains }, { email: contains }],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        title: true,
        company: { select: { name: true } },
      },
      take: PER_KIND,
    }),
    prisma.company.findMany({
      where: { OR: [{ name: contains }, { domain: contains }] },
      select: { id: true, name: true, industry: true, loc: true },
      take: PER_KIND,
    }),
    prisma.deal.findMany({
      where: { OR: [{ name: contains }, { offer: contains }] },
      select: {
        id: true,
        name: true,
        amount: true,
        status: true,
        company: { select: { name: true } },
      },
      take: PER_KIND,
    }),
    prisma.task.findMany({
      where: { done: false, title: contains },
      select: { id: true, title: true, owner: true, due: true },
      take: PER_KIND,
    }),
  ]);

  return [
    ...contacts.map((row) => ({
      kind: "contact" as const,
      id: row.id,
      label: contactTitle(row),
      detail: [row.title, row.company?.name].filter((v) => v !== "" && v != null).join(" · "),
      href: `/contacts?lifecycle=all&fiche=${row.id}`,
    })),
    ...companies.map((row) => ({
      kind: "company" as const,
      id: row.id,
      label: row.name,
      detail: [row.industry, row.loc].filter((v) => v !== "").join(" · "),
      href: `/societes?fiche=${row.id}`,
    })),
    ...deals.map((row) => ({
      kind: "deal" as const,
      id: row.id,
      label: row.name,
      detail: [row.company?.name, `${row.amount} €`].filter((v) => v != null).join(" · "),
      href: `/affaires?status=all&fiche=${row.id}`,
    })),
    ...tasks.map((row) => ({
      kind: "task" as const,
      id: row.id,
      label: row.title,
      detail: `${row.owner} · ${row.due.toISOString().slice(0, 10)}`,
      href: "/taches",
    })),
  ];
}
