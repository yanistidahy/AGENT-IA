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
import { enforceSignature, sanitizeSubject } from "@/lib/domain/email-format";
import { EMAIL_SIGNATURE } from "./prompts/company";
import { AGENTS } from "./registry";
import { readMailConfig } from "@/lib/api/mail";

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

/**
 * Les noms qui ne doivent jamais signer un email.
 *
 * Tirés du registre plutôt qu'écrits en dur : ajouter un agent demain le fait
 * entrer dans la garde sans que personne ait à y penser. Un agent renommé à
 * l'écran garde son nom de registre ici — c'est celui que le modèle voit dans
 * son prompt, donc celui qu'il risque d'employer.
 */
const AGENT_NAMES: readonly string[] = AGENTS.map((agent) => agent.name);

/**
 * Les noms qui ne doivent pas signer, **y compris celui de l'utilisateur**.
 *
 * Défaut trouvé à la vérification : un brouillon terminé par « Yanis » ne
 * portait pas de nom d'agent, donc la signature était **ajoutée** au lieu de
 * remplacer — et le message partait avec deux signatures l'une sous l'autre.
 * Le nom d'expédition configuré est donc joint à la liste : c'est exactement la
 * règle « jamais ton prénom, jamais celui de l'utilisateur », et il se lit là où
 * il est déjà réglé plutôt que d'être deviné.
 */
async function forbiddenSigners(): Promise<readonly string[]> {
  const config = await readMailConfig().catch(() => null);
  const sender = config?.fromName.trim() ?? "";
  if (sender === "") return AGENT_NAMES;

  // Le nom complet **et** le prénom seul : on signe rarement « Yanis Tidahy ».
  const first = sender.split(/\s+/)[0] ?? "";
  return first === "" || first === sender
    ? [...AGENT_NAMES, sender]
    : [...AGENT_NAMES, sender, first];
}

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
- La dernière ligne du corps est exactement : ${EMAIL_SIGNATURE}
- Aucun prix, aucun nom d'offre, aucun montant.
- N'invente aucun fait qui ne soit pas dans le dossier.`;

/**
 * La consigne de reprise.
 *
 * Elle rappelle **toutes** les contraintes de forme plutôt que de renvoyer à la
 * demande initiale : le modèle ne voit pas le premier échange, et une reprise
 * qui perdrait la signature ou laisserait passer un prix serait exactement le
 * genre de régression qu'on ne remarque qu'à la réception.
 */
const REVISE_INSTRUCTION = `Réécris ce message en appliquant la demande ci-dessus.

Rends exclusivement un objet JSON, sans texte autour, sans bloc de code :
{"subject": "...", "body": "..."}

- Pars du message **tel qu'il est ci-dessus** : il a pu être retouché à la main, et ces retouches sont voulues. Ne reviens pas à une version antérieure.
- Ne change que ce que la demande implique. Le reste du texte est conservé mot pour mot.
- \`body\` sépare ses paragraphes par une ligne vide (\\n\\n).
- La dernière ligne du corps est exactement : ${EMAIL_SIGNATURE}
- Aucun prix, aucun nom d'offre, aucun montant.
- N'invente aucun fait qui ne soit pas dans le dossier.`;

/**
 * Reprendre un brouillon sur instruction.
 *
 * **Le point qui compte : on repart du texte que l'utilisateur a sous les yeux**,
 * pas de ce qu'Alex avait produit. Quelqu'un qui a réécrit un paragraphe puis
 * demande « fais plus court » veut son paragraphe raccourci, pas l'original
 * raccourci. Repartir du brouillon d'origine jetterait silencieusement son
 * travail — et il ne s'en apercevrait qu'après l'envoi.
 *
 * Le contexte du contact est renvoyé aussi : sans lui, la reprise perdrait la
 * connaissance du dossier au deuxième tour et retomberait sur du générique.
 */
export async function reviseEmail(
  contactId: string,
  current: { readonly subject: string; readonly body: string },
  instruction: string,
  focusActivityId?: string,
): Promise<DraftResult> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { firstName: true, lastName: true, email: true },
  });
  if (contact === null) return { ok: false, message: "Contact introuvable." };

  const to = contact.email.trim();
  if (to === "") return { ok: false, message: "Ce contact n'a pas d'adresse électronique." };

  const context = await contextFor(contactId, focusActivityId);
  if (context === null) return { ok: false, message: "Contact introuvable." };

  const system = await promptForAgent(ALEX_SLUG);
  if (system === null) return { ok: false, message: "L'agent Alex est introuvable." };

  const ask = [
    context,
    "---",
    "Voici le message **dans son état actuel**. Il a pu être modifié à la main :",
    "",
    `Objet : ${current.subject}`,
    "",
    current.body,
    "",
    "---",
    `Demande de l'utilisateur : ${instruction}`,
    "",
    REVISE_INSTRUCTION,
  ].join("\n");

  return complete(system, ask, to, contact.firstName, contact.lastName);
}

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

  return complete(system, `${context}\n\n---\n\n${INSTRUCTION}`, to, contact.firstName, contact.lastName);
}

/**
 * L'appel au modèle, et les garanties de forme — **partagés** par la rédaction
 * et la reprise.
 *
 * Les écrire deux fois, c'est se garantir qu'une reprise finira par oublier la
 * signature ou l'échappement du bloc de code, le jour où l'une des deux sera
 * corrigée seule.
 */
async function complete(
  system: string,
  ask: string,
  to: string,
  firstName: string,
  lastName: string,
): Promise<DraftResult> {
  const forbidden = await forbiddenSigners();

  try {
    const response = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 2000,
      thinking: { type: "adaptive", display: "omitted" },
      output_config: { effort: "medium" },
      system,
      messages: [{ role: "user", content: ask }],
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
        // La signature est **imposée ici**, pas seulement demandée dans le
        // prompt : une consigne tient presque toujours, et « presque » n'est
        // pas assez quand la conséquence est qu'un prospect lit le prénom d'un
        // agent dans un message censé venir d'un humain.
        body: enforceSignature(checked.data.body.trim(), EMAIL_SIGNATURE, forbidden),
        to,
        contactName: `${firstName} ${lastName}`.trim(),
      },
    };
  } catch (error) {
    return { ok: false, message: describeAnthropicError(error) };
  }
}
