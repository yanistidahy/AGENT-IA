import "server-only";
import { prisma } from "../db";
import { searchText } from "../domain/text";
import {
  describeBulkOutcome,
  nameSimilarity,
  proposeDomain,
  SKIP_REASONS,
  SUSPICIOUS_BELOW,
  type DomainConfidence,
  type DomainRule,
  type SkipReason,
} from "../domain/domain-guess";
import type { UndoStep } from "./queue";

/**
 * La relecture des domaines proposés, une ligne à la fois.
 *
 * **Rien ici ne s'applique en masse, et rien ne vérifie une adresse.** Le
 * module lit les sociétés sans domaine, demande une proposition à
 * `lib/domain/domain-guess.ts` — pur, hors-ligne — et rend une liste à relire.
 * Accepter écrit une société ; refuser mémorise le refus pour que la ligne ne
 * revienne pas.
 *
 * **L'acceptation groupée n'existe que pour les déductions.**
 * `acceptManyDomains()` recalcule la proposition de chaque société et refuse
 * tout ce qui ne vient pas d'une adresse professionnelle déjà saisie. La
 * garantie est donc portée par le serveur, pas par un bouton caché : un appel
 * fabriqué à la main qui listerait des sociétés « supposées du nom » est
 * rejeté. Une déduction est une lecture de la donnée existante ; une
 * supposition n'est rien, et rien ne s'écrit en masse à partir de rien.
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
  /** Ressemblance nom ↔ domaine, de 0 à 1. Voir `nameSimilarity`. */
  readonly similarity: number;
  /** Sous le seuil : remontée en tête et marquée. */
  readonly suspicious: boolean;
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

    const similarity = nameSimilarity(company.name, proposal.value);

    rows.push({
      companyId: company.id,
      company: company.name,
      value: proposal.value,
      rule: proposal.rule,
      confidence: proposal.confidence,
      because: proposal.because,
      contacts: company.contacts.length,
      similarity,
      suspicious: similarity < SUSPICIOUS_BELOW,
    });
  }

  // Ce qui mérite un regard passe devant. Les déductions d'abord — c'est la
  // vue sur laquelle l'acceptation groupée existe — et, à l'intérieur, la
  // ressemblance la plus faible en tête : une adresse erronée dans la feuille
  // ne ressemble pas au nom de la société, et c'est le seul signal disponible
  // sans appeler le domaine.
  rows.sort(
    (left, right) =>
      Number(right.rule === "email") - Number(left.rule === "email") ||
      left.similarity - right.similarity ||
      left.company.localeCompare(right.company, "fr"),
  );

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

export interface BulkResult {
  readonly written: number;
  readonly skipped: number;
  /** Ce qui a été ignoré, et pourquoi — jamais un échec silencieux. */
  readonly skippedRows: ReadonlyArray<{ readonly company: string; readonly reason: string }>;
  readonly undo: readonly UndoStep[];
  readonly message: string;
}

/**
 * Accepte plusieurs propositions **déduites d'une adresse**, et elles seules.
 *
 * Trois refus, dans l'ordre où ils comptent :
 *
 * 1. **Une société dont la proposition courante n'est pas de règle `email` est
 *    ignorée.** C'est le garde-fou réel : le bouton n'apparaît que sous le
 *    filtre « Déduites d'une adresse », mais un bouton caché n'est pas une
 *    règle — celle-ci l'est.
 * 2. **Une société dont le domaine a été renseigné entre l'affichage et le
 *    clic est ignorée**, jamais écrasée. Même garde que l'acceptation à
 *    l'unité, portée par la condition du `updateMany`.
 * 3. **Une société dont la proposition a changé de valeur est ignorée** : ce
 *    qui serait écrit ne serait plus ce qui a été relu.
 *
 * Rend les étapes inverses. Elles sont **calculées avant d'écrire**, à partir
 * de l'état lu : les déduire après coup restaurerait une valeur plausible
 * plutôt que la vraie.
 */
export async function acceptManyDomains(
  entries: ReadonlyArray<{ readonly companyId: string; readonly value: string }>,
): Promise<BulkResult> {
  const companies = await prisma.company.findMany({
    where: { id: { in: entries.map((entry) => entry.companyId) } },
    select: {
      id: true,
      name: true,
      domain: true,
      industry: true,
      loc: true,
      searchText: true,
      contacts: { select: { email: true } },
    },
  });
  const byId = new Map(companies.map((company) => [company.id, company]));

  const undo: UndoStep[] = [];
  const skippedRows: Array<{ company: string; reason: string }> = [];
  const skipped: SkipReason[] = [];
  let written = 0;

  const skip = (company: string, reason: SkipReason) => {
    skipped.push(reason);
    skippedRows.push({ company, reason: SKIP_REASONS[reason].one });
  };

  for (const entry of entries) {
    const company = byId.get(entry.companyId);
    if (company === undefined) {
      skip(entry.companyId, "missing");
      continue;
    }

    if (company.domain !== "") {
      skip(company.name, "filled");
      continue;
    }

    const proposal = proposeDomain(
      company.name,
      company.contacts.map((contact) => contact.email),
    );

    if (proposal === null || proposal.rule !== "email") {
      skip(company.name, "notDeduced");
      continue;
    }
    if (proposal.value !== entry.value) {
      skip(company.name, "changed");
      continue;
    }

    const before: UndoStep = {
      kind: "company-domain",
      id: company.id,
      domain: company.domain,
      searchText: company.searchText,
    };

    const result = await prisma.company.updateMany({
      where: { id: company.id, domain: "" },
      data: {
        domain: proposal.value,
        searchText: searchText([company.name, proposal.value, company.industry, company.loc]),
      },
    });

    if (result.count === 0) {
      skip(company.name, "filled");
      continue;
    }

    undo.push(before);
    written += 1;
  }

  if (undo.length > 0) {
    await prisma.domainRejection.deleteMany({
      where: { companyId: { in: undo.map((step) => step.id) } },
    });
  }

  return {
    written,
    skipped: skipped.length,
    skippedRows,
    undo,
    message: describeBulkOutcome(written, skipped),
  };
}
