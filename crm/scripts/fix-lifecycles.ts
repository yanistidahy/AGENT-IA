import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import { fold } from "../lib/domain/text";
import { LOST_LIFECYCLE } from "../lib/domain/lost";
import { STATUS_CORRECTIONS, type StatusCorrection } from "./corrections-2026-08";

/**
 * Correction ponctuelle des cycles de vie, à partir de la feuille de prospection.
 *
 * **Ce n'est pas une migration.** Une migration décrit une forme de base ; ceci
 * corrige des *valeurs*, sur la foi d'un tableur qui n'est pas le schéma. Le
 * mettre dans `prisma/migrations/` le ferait rejouer sur toute base neuve, y
 * compris une base de test où ces contacts n'existent pas.
 *
 * Trois garanties tiennent tout le reste :
 *
 * 1. **Simulation par défaut.** Sans `--apply`, rien n'est écrit. La sortie
 *    montre fiche par fiche ce qui changerait.
 * 2. **Deux champs, jamais plus.** `lifecycle` et `lostReason`. Ni téléphone, ni
 *    notes, ni dates. Le `data` construit plus bas est le seul endroit où une
 *    écriture est décidée, et il est court exprès : on doit pouvoir le lire en
 *    entier d'un coup d'œil.
 * 3. **Idempotence.** Une fiche déjà dans l'état visé est comptée « inchangée »
 *    et n'est ni réécrite, ni re-consignée dans l'historique.
 *
 * Usage :
 *   npx tsx scripts/fix-lifecycles.ts            # simulation
 *   npx tsx scripts/fix-lifecycles.ts --apply    # écriture, après sauvegarde
 */

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");

/** Fiches candidates : celles que la feuille désigne, plus les « Ancien Client ». */
const CONTACT_FIELDS = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  lifecycle: true,
  lostReason: true,
  lastContact: true,
  company: { select: { name: true } },
  _count: { select: { activities: true } },
} satisfies Prisma.ContactSelect;

type Candidate = Prisma.ContactGetPayload<{ select: typeof CONTACT_FIELDS }>;

interface Change {
  readonly contact: Candidate;
  readonly lifecycle: string;
  readonly lostReason: string;
  readonly reason: string;
  /** Rapprochement par nom + société faute d'adresse : à vérifier à l'œil. */
  readonly uncertain: boolean;
}

function label(contact: Candidate): string {
  const company = contact.company?.name ?? "sans société";
  return `${contact.firstName} ${contact.lastName} (${company})`;
}

/**
 * Rapprochement feuille ↔ base.
 *
 * L'adresse électronique fait foi. À défaut, le couple nom + société, comparé
 * sans accents ni casse — la feuille écrit « Clément poyade » là où la base
 * porte « Clement Poyade ». Un rapprochement par nom seul serait trop lâche :
 * deux « Claire » dans deux sociétés différentes ne sont pas la même personne.
 */
function matches(contact: Candidate, correction: StatusCorrection): boolean {
  const email = contact.email.trim().toLowerCase();
  if (correction.email !== "" && email !== "") return email === correction.email;

  const sameName =
    fold(`${contact.firstName} ${contact.lastName}`) ===
    fold(`${correction.firstName} ${correction.lastName}`);
  const sameCompany = fold(contact.company?.name ?? "") === fold(correction.company);
  return sameName && sameCompany;
}

/**
 * Que devient un « Ancien Client » que la feuille ne mentionne pas ?
 *
 * La table des clients signés de la feuille est vide : aucun achat n'est prouvé,
 * donc aucun de ces contacts n'est un ancien client. Ils retournent d'où ils
 * viennent — `Prospect` si on les a touchés au moins une fois, `Lead` sinon.
 * C'est la seule distinction que la base permette de faire honnêtement.
 */
function demote(contact: Candidate): { lifecycle: string; reason: string } {
  const touched = contact.lastContact !== null || contact._count.activities > 0;
  return touched
    ? { lifecycle: "Prospect", reason: "aucun achat prouvé, mais au moins une touche enregistrée" }
    : { lifecycle: "Lead", reason: "aucun achat prouvé, aucune touche enregistrée" };
}

async function plan(): Promise<Change[]> {
  const candidates = await prisma.contact.findMany({ select: CONTACT_FIELDS });
  const changes: Change[] = [];
  const claimed = new Set<string>();

  // 1. Ce que la feuille désigne explicitement.
  for (const correction of STATUS_CORRECTIONS) {
    const found = candidates.filter((contact) => matches(contact, correction));

    if (found.length === 0) {
      console.log(
        `  ⚠ ligne ${correction.row} — introuvable en base : ${correction.firstName} ${correction.lastName} (${correction.company})`,
      );
      continue;
    }
    if (found.length > 1) {
      console.log(
        `  ⚠ ligne ${correction.row} — ${found.length} fiches correspondent, ignorée : ${correction.firstName} ${correction.lastName}`,
      );
      continue;
    }

    const contact = found[0];
    if (contact === undefined) continue;
    claimed.add(contact.id);

    changes.push({
      contact,
      lifecycle: correction.lifecycle,
      lostReason: correction.lostReason,
      reason: correction.evidence,
      uncertain: correction.email === "" || contact.email.trim() === "",
    });
  }

  // 2. Les « Ancien Client » que la feuille ne mentionne pas.
  for (const contact of candidates) {
    if (contact.lifecycle !== "Ancien Client" || claimed.has(contact.id)) continue;
    const { lifecycle, reason } = demote(contact);
    changes.push({ contact, lifecycle, lostReason: "", reason, uncertain: false });
  }

  return changes;
}

/** Une fiche déjà dans l'état visé n'est ni réécrite ni re-consignée. */
function isNoop(change: Change): boolean {
  return (
    change.contact.lifecycle === change.lifecycle &&
    change.contact.lostReason === change.lostReason
  );
}

async function backup(changes: readonly Change[]): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(process.cwd(), "backups");
  await mkdir(dir, { recursive: true });

  const file = path.join(dir, `lifecycles-${stamp}.json`);
  await writeFile(
    file,
    JSON.stringify(
      {
        takenAt: new Date().toISOString(),
        note: "État des fiches AVANT correction. Restaurer en réappliquant lifecycle et lostReason.",
        contacts: changes.map((change) => ({
          id: change.contact.id,
          firstName: change.contact.firstName,
          lastName: change.contact.lastName,
          company: change.contact.company?.name ?? null,
          lifecycle: change.contact.lifecycle,
          lostReason: change.contact.lostReason,
        })),
      },
      null,
      2,
    ),
    "utf8",
  );
  return file;
}

async function main(): Promise<void> {
  console.log(APPLY ? "== APPLICATION ==" : "== SIMULATION (aucune écriture) ==\n");

  const changes = await plan();
  const effective = changes.filter((change) => !isNoop(change));
  const unchanged = changes.length - effective.length;

  console.log("");
  for (const change of effective) {
    const motif = change.lostReason === "" ? "" : ` · motif : ${change.lostReason}`;
    const flag = change.uncertain ? " [rapprochement incertain]" : "";
    console.log(
      `  ${label(change.contact)}\n    ${change.contact.lifecycle} → ${change.lifecycle}${motif}${flag}\n    ${change.reason}`,
    );
  }

  const byTarget = new Map<string, number>();
  for (const change of effective) {
    const key = change.lostReason === "" ? change.lifecycle : `${change.lifecycle} · ${change.lostReason}`;
    byTarget.set(key, (byTarget.get(key) ?? 0) + 1);
  }

  console.log("\n-- Répartition --");
  for (const [key, count] of [...byTarget.entries()].sort()) {
    console.log(`  ${String(count).padStart(3)}  ${key}`);
  }
  console.log(`  ${String(unchanged).padStart(3)}  déjà à jour (aucune écriture)`);
  console.log(`  ${String(effective.length).padStart(3)}  fiches à modifier`);
  console.log(
    `  ${String(effective.filter((c) => c.uncertain).length).padStart(3)}  dont rapprochement incertain (sans adresse électronique)`,
  );

  if (!APPLY) {
    console.log("\nRien n'a été écrit. Relancer avec --apply pour appliquer.");
    return;
  }

  if (effective.length === 0) {
    console.log("\nRien à faire.");
    return;
  }

  const file = await backup(effective);
  console.log(`\nSauvegarde écrite : ${file}`);

  // Une transaction : la correction est un tout. Une base à moitié corrigée
  // serait pire que pas corrigée du tout — on ne saurait plus où on en est.
  await prisma.$transaction(async (tx) => {
    for (const change of effective) {
      await tx.contact.update({
        where: { id: change.contact.id },
        // Les deux seuls champs écrits par ce script.
        data: { lifecycle: change.lifecycle, lostReason: change.lostReason },
      });

      const motif = change.lostReason === "" ? "" : ` (${change.lostReason})`;
      await tx.activity.create({
        data: {
          type: "note",
          date: new Date(),
          owner: "Correction",
          notes: `Statut corrigé depuis la feuille de prospection : ${change.contact.lifecycle} → ${change.lifecycle}${motif}. ${change.reason}`,
          contactId: change.contact.id,
        },
      });
    }
  });

  console.log(`${effective.length} fiches corrigées, ${effective.length} interactions consignées.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
