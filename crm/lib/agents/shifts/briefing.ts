import { prisma } from "@/lib/db";
import { getPilotage } from "@/lib/api/reference";
import { addDays, daysSince, startOfDay } from "@/lib/domain/dates";
import { LOST_LIFECYCLE } from "@/lib/domain/lost";
import { ACTIVITY_LABELS, type PilotageSettings } from "@/lib/domain/types";
import { readProspectingReport } from "@/lib/api/prospecting";

/**
 * Briefing d'une vacation : les faits, calculés.
 *
 * **Le modèle ne compte pas.** « 7 prospects contactés une seule fois en
 * juillet » est une requête, pas un jugement : laisser un LLM énumérer, c'est
 * accepter qu'il se trompe de compte et cite des fiches inexistantes. Le
 * briefing est donc calculé ici, et le modèle n'apporte que l'arbitrage et la
 * formulation.
 *
 * Trois conséquences, toutes voulues :
 *
 * 1. les jetons d'entrée sont bornés par construction — chaque liste est
 *    plafonnée, et le plafond est visible ci-dessous ;
 * 2. un briefing vide **n'appelle pas le modèle du tout** : coût nul, zéro
 *    recommandation, et le journal dit « rien à signaler » ;
 * 3. le modèle ne peut plus inventer un chiffre. Il peut mal juger — un mode
 *    d'échec qu'on voit à l'écran.
 */

/** Plafond par liste. Au-delà, on tronque et on le dit dans le briefing. */
const CAP = 25;

export interface BriefingItem {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
}

/** Type d'enregistrement cité par une section. Sert aux preuves. */
export type SectionType = "contact" | "company" | "deal" | "task";

export interface BriefingSection {
  readonly key: string;
  readonly type: SectionType;
  readonly title: string;
  /** Ce que la section signifie, pour que le modèle n'ait pas à le deviner. */
  readonly meaning: string;
  readonly items: readonly BriefingItem[];
  readonly truncated: number;
}

export interface Briefing {
  readonly sections: readonly BriefingSection[];
  readonly settings: PilotageSettings;
  /** Vrai quand aucune section ne porte d'élément : le silence est la sortie. */
  readonly empty: boolean;
  /**
   * Mesures agrégées — rythme, taux de réponse par canal, arriéré.
   *
   * Séparées des sections, et **volontairement** : une section porte des
   * enregistrements dont chaque identifiant devient une preuve cliquable, alors
   * qu'un taux de réponse ne désigne aucune fiche. Les glisser parmi les
   * sections aurait produit des preuves qui ne résolvent pas, donc des constats
   * rejetés par la double résolution du jalon 14.
   *
   * Elles ne comptent pas dans `empty` : un CRM sans rien à signaler doit
   * rester silencieux et gratuit, même si ces lignes existent.
   */
  readonly context: readonly string[];
}

function section(
  key: string,
  type: SectionType,
  title: string,
  meaning: string,
  items: readonly BriefingItem[],
): BriefingSection {
  return {
    key,
    type,
    title,
    meaning,
    items: items.slice(0, CAP),
    truncated: Math.max(0, items.length - CAP),
  };
}

function name(contact: { firstName: string; lastName: string }): string {
  return `${contact.firstName} ${contact.lastName}`.trim();
}

/**
 * Vacation de Sacha : la discipline de relance.
 *
 * Quatre questions, chacune une requête. Les fiches `Perdu` sont écartées
 * partout : une relance sur quelqu'un qui a dit non n'est pas un oubli.
 */
export async function followUpBriefing(now: Date = new Date()): Promise<Briefing> {
  const settings = await getPilotage();
  const today = startOfDay(now);
  const notLost = { NOT: { lifecycle: LOST_LIFECYCLE } };

  const [due, silent, onceOnly, pushedBack] = await Promise.all([
    prisma.contact.findMany({
      where: { ...notLost, nextReminder: { lte: today } },
      select: { id: true, firstName: true, lastName: true, nextReminder: true, company: { select: { name: true } } },
      orderBy: { nextReminder: "asc" },
      take: CAP + 1,
    }),
    prisma.contact.findMany({
      where: {
        ...notLost,
        nextReminder: null,
        lastContact: { lt: addDays(today, -settings.coldDays) },
      },
      select: { id: true, firstName: true, lastName: true, lastContact: true, company: { select: { name: true } } },
      orderBy: { lastContact: "asc" },
      take: CAP + 1,
    }),
    // Contactés une seule fois et jamais relancés : le cas que l'usage réel a
    // fait remonter en premier.
    prisma.contact.findMany({
      where: { ...notLost, nextReminder: null, activities: { some: {} } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        company: { select: { name: true } },
        activities: { select: { date: true }, orderBy: { date: "desc" } },
      },
      take: 200,
    }),
    // Relances repoussées : l'échéance a plus de 30 jours de retard.
    prisma.contact.findMany({
      where: { ...notLost, nextReminder: { lt: addDays(today, -30) } },
      select: { id: true, firstName: true, lastName: true, nextReminder: true, company: { select: { name: true } } },
      orderBy: { nextReminder: "asc" },
      take: CAP + 1,
    }),
  ]);

  const single = onceOnly
    .filter((contact) => contact.activities.length === 1)
    .map((contact) => ({
      id: contact.id,
      label: `${name(contact)}${contact.company === null ? "" : ` (${contact.company.name})`}`,
      detail: `un seul échange, le ${contact.activities[0]?.date.toISOString().slice(0, 10) ?? "?"}`,
    }));

  const sections = [
    section(
      "due",
      "contact",
      "Relances arrivées à échéance",
      "Une date de relance a été posée et le jour est venu ou passé.",
      due.map((contact) => ({
        id: contact.id,
        label: `${name(contact)}${contact.company === null ? "" : ` (${contact.company.name})`}`,
        detail:
          contact.nextReminder === null
            ? ""
            : `échéance ${contact.nextReminder.toISOString().slice(0, 10)}`,
      })),
    ),
    section(
      "silent",
      "contact",
      `Sans nouvelles depuis plus de ${settings.coldDays} jours`,
      "Aucune relance programmée, et le dernier contact remonte au-delà du seuil configuré.",
      silent.map((contact) => ({
        id: contact.id,
        label: `${name(contact)}${contact.company === null ? "" : ` (${contact.company.name})`}`,
        detail:
          contact.lastContact === null
            ? "jamais contacté"
            : `${daysSince(contact.lastContact, now)} jours de silence`,
      })),
    ),
    section(
      "once",
      "contact",
      "Contactés une seule fois, jamais relancés",
      "Un seul échange enregistré et aucune relance programmée depuis.",
      single,
    ),
    section(
      "pushed",
      "contact",
      "Relances repoussées depuis plus de 30 jours",
      "L'échéance est dépassée de plus d'un mois : la relance est repoussée sans être traitée.",
      pushedBack.map((contact) => ({
        id: contact.id,
        label: `${name(contact)}${contact.company === null ? "" : ` (${contact.company.name})`}`,
        detail:
          contact.nextReminder === null
            ? ""
            : `${daysSince(contact.nextReminder, now)} jours de retard`,
      })),
    ),
  ];

  return {
    sections,
    settings,
    empty: sections.every((entry) => entry.items.length === 0),
    context: await prospectingContext(),
  };
}

/**
 * Les mesures de prospection, en phrases.
 *
 * Le modèle ne compte rien — même règle que pour les sections : les nombres
 * viennent de PostgreSQL par le service que `/rapports` emploie, et l'agent ne
 * fait que les commenter. « Votre taux de réponse au téléphone est trois fois
 * celui de l'email » n'est utile que si les deux nombres sont exacts.
 */
async function prospectingContext(): Promise<string[]> {
  try {
    const report = await readProspectingReport();
    const lines: string[] = [];

    const weeks = report.rhythm.slice(-4);
    const recent = weeks.reduce((sum, week) => sum + week.total, 0);
    lines.push(`Interactions consignées sur les 4 dernières semaines : ${recent}.`);

    for (const channel of report.channels) {
      lines.push(
        channel.rate === null
          ? `${ACTIVITY_LABELS[channel.channel]} : ${channel.total} échange(s), aucune issue renseignée — taux inconnu.`
          : `${ACTIVITY_LABELS[channel.channel]} : ${channel.total} échange(s), ${channel.rate} % de réponse sur ${channel.known} à l'issue connue.`,
      );
    }

    if (report.firstTouch.untouched > 0) {
      lines.push(
        `${report.firstTouch.untouched} contact(s) n'ont jamais été approchés` +
          (report.firstTouch.untouchedMedianAgeDays === null
            ? "."
            : `, depuis ${report.firstTouch.untouchedMedianAgeDays} jours en médiane.`),
      );
    }

    const honoured = report.discipline.reduce((sum, week) => sum + week.honoured, 0);
    const missed = report.discipline.reduce((sum, week) => sum + week.missed, 0);
    if (honoured + missed > 0) {
      lines.push(`Relances : ${honoured} tenue(s) à l'échéance, ${missed} manquée(s).`);
    }

    return lines;
  } catch (error) {
    // Le contexte est un bonus : son échec ne doit pas empêcher une vacation
    // de signaler ce qu'elle a bel et bien trouvé.
    console.error("[vacation] contexte de prospection", error);
    return [];
  }
}

/**
 * Vacation d'Alfred : la vue d'ensemble et la qualité des données.
 *
 * Il reçoit en plus les recommandations produites par le même run — c'est ce qui
 * lui permet d'arbitrer sans redire ce que les autres viennent de dire.
 */
export async function qualityBriefing(now: Date = new Date()): Promise<Briefing> {
  const settings = await getPilotage();

  const [incomplete, orphanCompanies, frozen] = await Promise.all([
    prisma.contact.findMany({
      where: { OR: [{ AND: [{ email: "" }, { phone: "" }] }, { lastName: { contains: "," } }] },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      take: CAP + 1,
    }),
    prisma.company.findMany({
      where: { contacts: { none: {} }, deals: { none: {} } },
      select: { id: true, name: true },
      take: CAP + 1,
    }),
    // Statut figé : saisi, puis dépassé par une interaction plus récente.
    prisma.contact.findMany({
      where: { NOT: { status: "" } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
        statusSetAt: true,
        activities: { select: { date: true }, orderBy: { date: "desc" }, take: 1 },
      },
      take: 200,
    }),
  ]);

  const stale = frozen
    .filter((contact) => {
      const last = contact.activities[0]?.date ?? null;
      if (last === null) return false;
      return contact.statusSetAt === null || last > contact.statusSetAt;
    })
    .map((contact) => ({
      id: contact.id,
      label: name(contact),
      detail: `statut « ${contact.status} » antérieur à la dernière interaction`,
    }));

  const sections = [
    section(
      "incomplete",
      "contact",
      "Fiches qu'on ne sait pas joindre",
      "Ni adresse électronique ni téléphone, ou un nom contenant une note avalée à l'import.",
      incomplete.map((contact) => ({
        id: contact.id,
        label: name(contact),
        detail: contact.email === "" && contact.phone === "" ? "aucun moyen de contact" : "nom à nettoyer",
      })),
    ),
    section(
      "orphan",
      "company",
      "Sociétés sans contact ni affaire",
      "Créées à la volée puis jamais rattachées à personne.",
      orphanCompanies.map((company) => ({
        id: company.id,
        label: company.name,
        detail: "aucun contact, aucune affaire",
      })),
    ),
    section(
      "frozen",
      "contact",
      "Statuts figés",
      "Un statut a été saisi, puis une interaction plus récente l'a dépassé sans qu'il soit remis à jour.",
      stale,
    ),
  ];

  return {
    sections,
    settings,
    empty: sections.every((entry) => entry.items.length === 0),
    context: await prospectingContext(),
  };
}


/** Rendu texte du briefing, tel qu'il part au modèle. */
export function renderBriefing(briefing: Briefing): string {
  const parts: string[] = [];

  if (briefing.context.length > 0) {
    parts.push(
      "## Mesures de prospection (agrégats — ne pas citer comme preuve, aucun enregistrement associé)",
    );
    for (const line of briefing.context) parts.push(`- ${line}`);
    parts.push("");
  }

  for (const entry of briefing.sections) {
    if (entry.items.length === 0) continue;

    const lines = entry.items.map(
      (item) => `  - [${entry.type}:${item.id}] ${item.label} — ${item.detail}`,
    );
    if (entry.truncated > 0) {
      lines.push(`  - … et ${entry.truncated} autre(s), non listés (plafond de contexte).`);
    }
    parts.push(`## ${entry.title} (${entry.items.length})\n${entry.meaning}\n${lines.join("\n")}`);
  }

  return parts.join("\n\n");
}
