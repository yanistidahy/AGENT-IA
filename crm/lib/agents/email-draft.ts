import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { anthropic, describeAnthropicError, MODEL } from "./runtime/client";
import { promptForAgent } from "@/lib/api/agents";
import { REAL_ACTIVITY } from "@/lib/api/real-activity";
import { resolveContactStatus } from "@/lib/domain/contact-status";
import { toLifecycle } from "@/lib/domain/guards";
import { getPilotage } from "@/lib/api/reference";
import { ACTIVITY_LABELS, type ActivityType } from "@/lib/domain/types";
import { OUTCOME_LABELS, isOutcome } from "@/lib/domain/status";
import { formatDate } from "@/lib/format";
import { sanitizeSubject } from "@/lib/domain/email-format";

/**
 * Le brouillon d'Alex.
 *
 * **Le contexte est collecté ici, pas laissé au modèle.** Même principe que les
 * briefings de vacation du jalon 14 : on ne demande pas au modèle d'aller
 * chercher, on lui donne des faits déjà établis et il n'a plus qu'à écrire.
 * Trois conséquences, et c'est pour elles que cette fonction existe :
 *
 * 1. **le message ne peut pas inventer un échange** — il ne dispose que de ce
 *    qui est réellement consigné ;
 * 2. **aucun appel d'outil**, donc une seule requête, prévisible et bon marché ;
 * 3. **l'entrée est bornée** — dix interactions, pas l'historique entier.
 *
 * Le modèle rend du JSON strict. Une réponse hors forme est refusée plutôt que
 * rafistolée : mieux vaut un message d'erreur qu'un objet vide envoyé à un
 * prospect.
 */

const ALEX_SLUG = "alex";

/** Ce que le modèle doit rendre, et rien d'autre. */
const draftSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
});

export interface EmailDraft {
  readonly subject: string;
  readonly body: string;
  readonly to: string;
  readonly contactName: string;
}

export type DraftResult =
  | { readonly ok: true; readonly draft: EmailDraft }
  | { readonly ok: false; readonly message: string };

/** Le dossier réel du contact, mis en phrases pour le modèle. */
async function contextFor(contactId: string, focusActivityId?: string): Promise<string | null> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: {
      firstName: true,
      lastName: true,
      title: true,
      email: true,
      status: true,
      lifecycle: true,
      lostReason: true,
      lastContact: true,
      nextReminder: true,
      notes: true,
      company: { select: { name: true, industry: true, size: true } },
      deals: {
        select: { name: true, amount: true, status: true, stage: { select: { name: true } } },
        orderBy: { amount: "desc" },
        take: 3,
      },
      activities: {
        where: REAL_ACTIVITY,
        select: { id: true, type: true, date: true, notes: true, outcome: true },
        orderBy: { date: "desc" },
        take: 10,
      },
      _count: { select: { activities: { where: REAL_ACTIVITY } } },
    },
  });

  if (contact === null) return null;

  const [settings, now] = [await getPilotage(), new Date()];
  const resolved = resolveContactStatus(
    {
      status: contact.status,
      lifecycle: toLifecycle(contact.lifecycle),
      lastContact: contact.lastContact,
      nextReminder: contact.nextReminder,
      activityCount: contact._count.activities,
    },
    settings,
    now,
  );

  const lines: string[] = [];
  lines.push(`Destinataire : ${contact.firstName} ${contact.lastName}${contact.title === "" ? "" : `, ${contact.title}`}`);
  if (contact.company !== null) {
    const details = [contact.company.industry, contact.company.size].filter((v) => v !== "");
    lines.push(`Société : ${contact.company.name}${details.length ? ` (${details.join(", ")})` : ""}`);
  }
  lines.push(`Statut affiché : ${resolved.label}`);
  lines.push(`Cycle de vie : ${contact.lifecycle}${contact.lostReason === "" ? "" : ` — ${contact.lostReason}`}`);
  lines.push(
    contact.lastContact === null
      ? "Dernier contact : jamais"
      : `Dernier contact : ${formatDate(contact.lastContact)}`,
  );
  lines.push(`Nombre d'échanges réels consignés : ${contact._count.activities}`);

  for (const deal of contact.deals) {
    lines.push(`Affaire : « ${deal.name} », ${deal.amount} €, étape ${deal.stage.name}, ${deal.status}`);
  }

  if (contact.activities.length === 0) {
    lines.push("");
    lines.push("Aucun échange consigné : c'est une première prise de contact.");
  } else {
    lines.push("");
    lines.push("Historique, du plus récent au plus ancien :");
    for (const activity of contact.activities) {
      const type = ACTIVITY_LABELS[activity.type as ActivityType] ?? activity.type;
      const outcome = isOutcome(activity.outcome) ? ` — ${OUTCOME_LABELS[activity.outcome]}` : "";
      // L'échange d'où part la rédaction est **désigné**, pas seulement inclus :
      // c'est celui auquel le message doit se référer, et le noyer dans la liste
      // produirait une relance générique — le défaut que ce jalon doit éviter.
      const focus = activity.id === focusActivityId ? "  ← L'ÉCHANGE QUI VIENT D'AVOIR LIEU" : "";
      lines.push(`- ${formatDate(activity.date)} · ${type}${outcome}${focus}`);
      const notes = activity.notes.trim();
      if (notes !== "") lines.push(`  Notes : ${notes.slice(0, 400)}`);
    }
  }

  const notes = contact.notes.trim();
  if (notes !== "") {
    lines.push("");
    lines.push(`Notes de la fiche : ${notes.slice(0, 600)}`);
  }

  return lines.join("\n");
}

const INSTRUCTION = `Rédige **un** email à partir du dossier ci-dessus.

Rends exclusivement un objet JSON, sans texte autour, sans bloc de code :
{"subject": "...", "body": "..."}

Contraintes de forme, non négociables :
- \`body\` sépare ses paragraphes par une ligne vide (\\n\\n). Trois paragraphes courts valent mieux qu'un bloc.
- Trois à six phrases au total.
- Une seule demande, à la fin, à laquelle on peut répondre en une ligne.
- Pas de signature en bloc : un prénom sur la dernière ligne suffit.
- N'invente aucun fait qui ne soit pas dans le dossier.`;

export async function draftEmail(
  contactId: string,
  focusActivityId?: string,
): Promise<DraftResult> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { firstName: true, lastName: true, email: true },
  });

  if (contact === null) return { ok: false, message: "Contact introuvable." };

  const to = contact.email.trim();
  if (to === "") {
    return {
      ok: false,
      message: "Ce contact n'a pas d'adresse électronique. Renseignez-la sur sa fiche avant d'écrire.",
    };
  }

  const context = await contextFor(contactId, focusActivityId);
  if (context === null) return { ok: false, message: "Contact introuvable." };

  const system = await promptForAgent(ALEX_SLUG);
  if (system === null) return { ok: false, message: "L'agent Alex est introuvable." };

  try {
    const response = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 2000,
      thinking: { type: "adaptive", display: "omitted" },
      output_config: { effort: "medium" },
      system,
      messages: [{ role: "user", content: `${context}\n\n---\n\n${INSTRUCTION}` }],
    });

    const text = response.content
      .filter((block): block is { type: "text"; text: string } & typeof block => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    // Le modèle enrobe parfois son JSON d'un bloc de code, malgré la consigne.
    const json = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { ok: false, message: "Alex n'a pas rendu un brouillon exploitable. Réessayez." };
    }

    const checked = draftSchema.safeParse(parsed);
    if (!checked.success) {
      return { ok: false, message: "Alex n'a pas rendu un brouillon exploitable. Réessayez." };
    }

    return {
      ok: true,
      draft: {
        subject: sanitizeSubject(checked.data.subject),
        body: checked.data.body.trim(),
        to,
        contactName: `${contact.firstName} ${contact.lastName}`.trim(),
      },
    };
  } catch (error) {
    return { ok: false, message: describeAnthropicError(error) };
  }
}
