import { prisma } from "../db";
import { inheritedCompanyId } from "../domain/deal-company";
import { contactTitle } from "../domain/contact-identity";

/**
 * Rattraper les affaires nées sans société.
 *
 * Le correctif de `createDeal` / `updateDeal` ne vaut que pour l'avenir : les
 * affaires déjà en base gardent leur `companyId` vide, restent hors des totaux
 * de `/societes` et continuent d'afficher « Sans société » sur leur carte. Ce
 * rattrapage lit la société du **contact principal** de chaque affaire orpheline
 * et la recopie.
 *
 * Mêmes garanties que les reports de feuille des jalons 11, 21 et 25 :
 * simulation d'abord, **une seule colonne** touchée, idempotent, et la
 * condition d'écriture porte sur la valeur relue — une affaire rattachée à la
 * main entre la simulation et le clic n'est pas écrasée.
 *
 * Pas de sauvegarde préalable, et c'est délibéré : la valeur écrite est
 * *déduite* d'une donnée qui reste en place sur la fiche du contact. Rien n'est
 * remplacé, seul un vide est comblé — il n'y a donc rien à perdre, à la
 * différence d'une correction de statut qui, elle, écrase un choix.
 */
export interface DealCompanyFix {
  readonly dealId: string;
  readonly dealName: string;
  readonly contactName: string;
  readonly companyId: string;
  readonly companyName: string;
}

export interface DealCompanyPlan {
  readonly fixes: readonly DealCompanyFix[];
  /** Affaires sans société **et** sans rien à en déduire — à traiter à la main. */
  readonly unresolved: readonly string[];
  /** Affaires sans société examinées, toutes causes confondues. */
  readonly examined: number;
}

export async function planDealCompanyBackfill(): Promise<DealCompanyPlan> {
  const orphans = await prisma.deal.findMany({
    where: { companyId: null },
    select: {
      id: true,
      name: true,
      companyId: true,
      contact: {
        select: {
          firstName: true,
          lastName: true,
          companyId: true,
          company: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const fixes: DealCompanyFix[] = [];
  const unresolved: string[] = [];

  for (const deal of orphans) {
    const companyId = inheritedCompanyId({
      dealCompanyId: deal.companyId,
      contactCompanyId: deal.contact?.companyId ?? null,
    });
    const companyName = deal.contact?.company?.name;

    // Le nom de la société est requis pour que la relecture montre ce qui sera
    // écrit : un rattachement qu'on ne peut pas nommer ne se relit pas.
    if (companyId === null || companyName === undefined) {
      unresolved.push(deal.name);
      continue;
    }

    fixes.push({
      dealId: deal.id,
      dealName: deal.name,
      contactName: deal.contact === null ? "" : contactTitle(deal.contact),
      companyId,
      companyName,
    });
  }

  return { fixes, unresolved, examined: orphans.length };
}

export interface DealCompanyReport {
  readonly linked: number;
  /** Affaires dont la société a été renseignée entre la simulation et le clic. */
  readonly skipped: number;
}

export async function applyDealCompanyBackfill(
  plan: DealCompanyPlan,
): Promise<DealCompanyReport> {
  let linked = 0;

  for (const fix of plan.fixes) {
    // `companyId: null` dans le `where` : si l'affaire a été rattachée
    // entre-temps, la mise à jour ne touche aucune ligne au lieu d'écraser un
    // choix qu'on n'a pas relu. Même garde que l'acceptation des domaines au
    // jalon 26.
    const result = await prisma.deal.updateMany({
      where: { id: fix.dealId, companyId: null },
      data: { companyId: fix.companyId },
    });
    linked += result.count;
  }

  return { linked, skipped: plan.fixes.length - linked };
}
