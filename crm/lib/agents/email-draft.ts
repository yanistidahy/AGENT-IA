import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { anthropic, describeAnthropicError } from "./runtime/client";
import { requestFor } from "./runtime/request";
import { modelFor } from "@/lib/api/reference";
import { budgetRefusal, recordUsage, usageOf } from "@/lib/api/usage";
import { promptForAgent } from "@/lib/api/agents";
import { REAL_ACTIVITY } from "@/lib/api/real-activity";
import { resolveContactStatus } from "@/lib/domain/contact-status";
import { toLifecycle } from "@/lib/domain/guards";
import { getPilotage } from "@/lib/api/reference";
import { ACTIVITY_LABELS, type ActivityType } from "@/lib/domain/types";
import { OUTCOME_LABELS, isOutcome } from "@/lib/domain/status";
import { formatDate } from "@/lib/format";
import { enforceSignature, sanitizeSubject } from "@/lib/domain/email-format";
import { signatureBlock } from "./prompts/company";
import { demoTarget, demoTargetRule } from "@/lib/domain/demo-target";
import { alexDynamicRules } from "./alex-rules";
import { AGENTS } from "./registry";
import { readMailConfig, type MailConfig } from "@/lib/api/mail";
import {
  listSignatories,
  pickSignatory,
  signatoryNames,
  type Signatory,
} from "@/lib/api/signatories";

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
function forbiddenSigners(
  config: MailConfig,
  signatories: readonly Signatory[],
): readonly string[] {
  // **Tous les signataires**, pas seulement celui qui signe ce message : un
  // brouillon destiné à partir sous le nom de Mohamed ne doit pas se terminer
  // par celui de Yanis. Plus le nom d'expédition SMTP, et le prénom seul de
  // chacun — on signe rarement de son nom entier.
  //
  // C'est aussi le correctif du jalon 33 qu'il ne faut pas reperdre : un
  // brouillon terminé par « Yanis » ne porte aucun nom d'agent, la signature
  // serait donc *ajoutée* et le message partirait avec deux signatures.
  const extra = new Set(signatoryNames(signatories));
  const sender = config.fromName.trim();
  if (sender !== "") {
    extra.add(sender);
    const first = sender.split(/\s+/)[0] ?? "";
    if (first !== "") extra.add(first);
  }

  return [...AGENT_NAMES, ...extra];
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
  /** Les signataires disponibles, pour le sélecteur du panneau. */
  readonly signatories: readonly Signatory[];
  /** Celui qui a été retenu — le propriétaire de la fiche s'il correspond. */
  readonly signatoryId: string | null;
}

export type DraftResult =
  | { readonly ok: true; readonly draft: EmailDraft }
  | { readonly ok: false; readonly message: string };

/** Le dossier réel du contact, mis en phrases pour le modèle. */
async function contextFor(contactId: string, focusActivityId?: string): Promise<ContextResult | null> {
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
      website: true,
      company: { select: { name: true, industry: true, size: true, domain: true } },
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

  // Le DM Instagram : un **fait**, cherché séparément et daté. Le laisser se
  // déduire de la liste des dix dernières interactions serait un pari — sur une
  // fiche bavarde le DM en sort, et Alex se met alors à mentionner un message
  // qu'on n'a peut-être jamais envoyé. C'est le genre de petit mensonge qui tue
  // une première prise de contact, donc il ne se déduit pas : il se demande.
  const dm = await prisma.activity.findFirst({
    where: { ...REAL_ACTIVITY, contactId, type: "instagram" },
    select: { date: true },
    orderBy: { date: "desc" },
  });

  const target = demoTarget({
    website: contact.website,
    companyDomain: contact.company?.domain ?? "",
    companyName: contact.company?.name ?? "",
  });

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

  // Les deux faits que la nouvelle forme d'email exige, annoncés sans ambiguïté
  // et **toujours présents** — y compris à la forme négative. Une absence de
  // ligne se lit comme une absence d'information ; une ligne qui dit « non »
  // se lit comme une interdiction.
  lines.push(
    dm === null
      ? "DM Instagram : AUCUN n'a été envoyé à cette personne."
      : `DM Instagram : envoyé le ${formatDate(dm.date)}.`,
  );
  lines.push(
    target.kind === "site"
      ? `Site à citer dans la phrase de démonstration : ${target.value}`
      : target.kind === "brand"
        ? `Site à citer : AUCUN site connu. Marque à nommer : ${target.value}`
        : "Site à citer : AUCUN site ni nom de marque connu.",
  );

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

  return { dossier: lines.join("\n"), target, dmSent: dm !== null };
}

/**
 * Le dossier, plus les deux faits qui commandent des consignes distinctes :
 * ce que la phrase de démonstration doit nommer, et si un DM existe vraiment.
 */
interface ContextResult {
  readonly dossier: string;
  readonly target: ReturnType<typeof demoTarget>;
  readonly dmSent: boolean;
}

/**
 * Les consignes de rédaction.
 *
 * **Elles ne répètent plus le prompt système, et c'est le sujet.** Jusqu'au
 * jalon 35, ce bloc redonnait l'ouverture sur leur activité, la douleur de leur
 * côté, le conseiller proactif, la démonstration préparée, les deux appels à
 * l'action, la signature et le libellé du lien — soit sept règles déjà écrites
 * dans `WRITING_SHAPE`, `COMPANY_CONTEXT`, `signatureRule()` et `demoRule()`,
 * quelques lignes plus haut dans la même requête. On payait deux fois pour
 * chaque brouillon le même texte, et le risque n'était pas seulement le coût :
 * deux formulations d'une même règle finissent par se contredire, et c'est
 * alors le modèle qui arbitre.
 *
 * Ne reste ici que ce que le prompt système ne peut pas porter : **la forme de
 * la réponse**. Le reste est au-dessus.
 */
function draftInstruction(context: ContextResult): string {
  return `Rédige **un** email à partir du dossier ci-dessus, en appliquant les
règles de forme, de signature et de lien données plus haut.

${demoTargetRule(context.target)}

${dmRule(context.dmSent)}

Rends exclusivement un objet JSON, sans texte autour, sans bloc de code :
{"subject": "...", "body": "..."}

Deux points propres à cette forme :
- \`body\` sépare ses paragraphes par une ligne vide (\\n\\n) ;
- n'invente aucun fait qui ne soit pas dans le dossier.`;
}

/**
 * **Mentionner le DM, ou se taire — et c'est la donnée qui tranche.**
 *
 * La consigne est construite depuis le fait, pas laissée au jugement : « parle
 * du DM si tu en as envoyé un » invite un modèle à supposer qu'il y en a eu
 * un, puisque la phrase existe. Ici, l'une des deux consignes seulement atteint
 * le modèle, et celle du cas négatif est une **interdiction**, pas une
 * omission.
 *
 * L'enjeu est petit et fatal : affirmer « je vous ai écrit sur Instagram » à
 * quelqu'un qui n'a rien reçu se vérifie en trois secondes, et ce qui tombe
 * alors n'est pas l'email, c'est la relation.
 */
function dmRule(dmSent: boolean): string {
  if (dmSent) {
    return `**Un DM Instagram a bien été envoyé à cette personne**, et le dossier en donne la date. Mentionne-le dans le corps du message, après l'accroche : dis que tu lui as écrit sur Instagram et invite-la à regarder ses messages privés. C'est une raison concrète et vérifiable de prêter attention à cet email — jamais « je me permets de vous relancer », qui ne parle que de ton agenda.`;
  }
  return `**Aucun DM Instagram n'a été envoyé à cette personne.** N'en mentionne donc aucun, sous aucune forme : ni « comme je vous l'écrivais sur Instagram », ni « vous avez dû voir mon message ». Ce serait une affirmation fausse, vérifiable en trois secondes par le destinataire. Écris l'email sans cette mention.`;
}

export async function draftEmail(
  contactId: string,
  focusActivityId?: string,
  /**
   * Consigne propre à une étape de séquence.
   *
   * Passée telle quelle **après** les règles générales : une étape de relance
   * ne change pas la forme d'un email, elle change ce qu'il doit dire. Écrire
   * une seconde instruction de rédaction ici aurait recréé la duplication que
   * le jalon 36 vient de supprimer.
   */
  stepBrief?: string,
): Promise<DraftResult> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { firstName: true, lastName: true, email: true, owner: true },
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

  const [config, signatories] = await Promise.all([readMailConfig(), listSignatories()]);
  // Le propriétaire de la fiche d'abord : si « Yanis » suit ce prospect, c'est
  // lui qui écrit. Proposer systématiquement le signataire par défaut ferait
  // partir la moitié des messages sous la mauvaise identité.
  const signatory = pickSignatory(signatories, contact.owner);

  const system = await promptForAgent(ALEX_SLUG, await alexDynamicRules(signatory));
  if (system === null) return { ok: false, message: "L'agent Alex est introuvable." };

  return complete(
    system,
    `${context.dossier}\n\n---\n\n${draftInstruction(context)}${
      stepBrief === undefined || stepBrief.trim() === ""
        ? ""
        : `\n\nConsigne propre à ce message : ${stepBrief.trim()}`
    }`,
    to,
    contact.firstName,
    contact.lastName,
    config,
    signatories,
    signatory,
  );
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
  config: MailConfig,
  signatories: readonly Signatory[],
  signatory: Signatory | null,
): Promise<DraftResult> {
  const forbidden = forbiddenSigners(config, signatories);
  const signature =
    signatory === null
      ? signatureBlock({ name: config.signName, title: config.signTitle })
      : signatureBlock(signatory);

  // **Le plafond est vérifié avant l'appel, pas pendant.** Le garde-fou
  // existait pour les vacations depuis le jalon 14 ; il couvre désormais la
  // rédaction, qui est ce qui coûte réellement.
  const refusal = await budgetRefusal();
  if (refusal !== null) return { ok: false, message: refusal };

  const model = await modelFor("draft");

  try {
    const response = await anthropic().messages.create({
      ...requestFor("draft", model),
      system,
      messages: [{ role: "user", content: ask }],
    });

    await recordUsage({
      agentId: ALEX_SLUG,
      purpose: "draft",
      model,
      usage: usageOf(response.usage),
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
        body: enforceSignature(checked.data.body.trim(), signature, forbidden),
        to,
        contactName: `${firstName} ${lastName}`.trim(),
        signatories,
        signatoryId: signatory?.id ?? null,
      },
    };
  } catch (error) {
    return { ok: false, message: describeAnthropicError(error) };
  }
}
