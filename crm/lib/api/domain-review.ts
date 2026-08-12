import "server-only";
import { prisma } from "../db";
import { searchText } from "../domain/text";
import {
  proposeDomain,
  type DomainConfidence,
  type DomainRule,
} from "../domain/domain-guess";

/**
 * La relecture des domaines proposés, une ligne à la fois.
 *
 * **Rien ici ne s'applique en masse, et rien ne vérifie une adresse.** Le
 * module lit les sociétés sans domaine, demande une proposition à
 * `lib/domain/domain-guess.ts` — pur, hors-ligne — et rend une liste à relire.
 * Accepter écrit une société ; refuser mémorise le refus pour que la ligne ne
 * revienne pas. Il n'existe pas de fonction qui écrive plusieurs domaines
 * d'un coup, et c'est volontaire : une proposition n'est pas un fait.
 */

export interface DomainProposalRow {
  readonly companyId: string;
  readonly company: string;
  readonly value: string;
  readonly rule: DomainRule;
  readonly confidence: DomainConfidence;
  readonly because: string;
  /** Combien de fiches portent cette société — de quoi juger l'enjeu. */
  readonly contacts: number;
}

export interface DomainReview {
  readonly rows: readonly DomainProposalRow[];
  /** Sociétés sans domaine pour lesquelles aucune proposition n'est honnête. */
  readonly noProposal: readonly string[];
  readonly totals: {
    readonly companies: number;
    readonly withDomain: number;
    readonly withoutDomain: number;
    readonly fromEmail: number;
    readonly fromName: number;
    readonly rejected: number;
  };
}

export async function readDomainReview(): Promise<DomainReview> {
  const [companies, rejections] = await Promise.all([
    prisma.company.findMany({
      select: {
        id: true,
        name: true,
        domain: true,
        contacts: { select: { email: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.domainRejection.findMany({ select: { companyId: true, proposed: true } }),
  ]);

  const refused = new Map(rejections.map((row) => [row.companyId, row.proposed]));

  const rows: DomainProposalRow[] = [];
  const noProposal: string[] = [];
  let fromEmail = 0;
  let fromName = 0;

  for (const company of companies) {
    if (company.domain !== "") continue;

    const proposal = proposeDomain(
      company.name,
      company.contacts.map((contact) => contact.email),
    );

    if (proposal === null) {
      noProposal.push(company.name);
      continue;
    }

    // Une proposition déjà refusée ne revient pas — sauf si la règle produit
    // désormais **autre chose**, auquel cas c'est une nouvelle proposition et
    // elle mérite d'être revue.
    if (refused.get(company.id) === proposal.value) continue;

    if (proposal.rule === "email") fromEmail += 1;
    else fromName += 1;

    rows.push({
      companyId: company.id,
      company: company.name,
      value: proposal.value,
      rule: proposal.rule,
      confidence: proposal.confidence,
      because: proposal.because,
      contacts: company.contacts.length,
    });
  }

  return {
    rows,
    noProposal,
    totals: {
      companies: companies.length,
      withDomain: companies.filter((company) => company.domain !== "").length,
      withoutDomain: companies.filter((company) => company.domain === "").length,
      fromEmail,
      fromName,
      rejected: rejections.length,
    },
  };
}

export type DomainDecision =
  | { readonly ok: true; readonly message: string }
  | { readonly ok: false; readonly message: string };

/**
 * Accepte une proposition — **une** société, **un** champ.
 *
 * La condition `domain: ""` est portée par la requête et non par une lecture
 * préalable : si quelqu'un a renseigné le domaine entre l'affichage de la
 * liste et le clic, l'écriture ne trouve rien à modifier et le dit, au lieu
 * d'écraser une valeur saisie à la main.
 */
export async function acceptDomain(
  companyId: string,
  value: string,
): Promise<DomainDecision> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, domain: true, industry: true, loc: true },
  });
  if (company === null) return { ok: false, message: "Société introuvable." };
  if (company.domain !== "") {
    return {
      ok: false,
      message: `« ${company.name} » porte déjà le domaine « ${company.domain} ». Rien n'a été écrit.`,
    };
  }

  const written = await prisma.company.updateMany({
    where: { id: companyId, domain: "" },
    data: {
      domain: value,
      // Le miroir de recherche porte le domaine : sans ce recalcul, la société
      // resterait introuvable par son adresse.
      searchText: searchText([company.name, value, company.industry, company.loc]),
    },
  });

  if (written.count === 0) {
    return { ok: false, message: "Le domaine a été renseigné entre-temps. Rien n'a été écrit." };
  }

  // Un refus mémorisé n'a plus de sens une fois la valeur acceptée.
  await prisma.domainRejection.deleteMany({ where: { companyId } });

  return { ok: true, message: `« ${company.name} » → ${value}` };
}

/** Écarte une proposition. N'écrit rien sur la société. */
export async function rejectDomain(
  companyId: string,
  value: string,
): Promise<DomainDecision> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });
  if (company === null) return { ok: false, message: "Société introuvable." };

  await prisma.domainRejection.upsert({
    where: { companyId },
    create: { companyId, proposed: value },
    update: { proposed: value, rejectedAt: new Date() },
  });

  return { ok: true, message: `« ${company.name} » — proposition écartée.` };
}
