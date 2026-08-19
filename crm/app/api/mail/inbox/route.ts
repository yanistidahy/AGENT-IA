import { z } from "zod";
import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { prisma } from "@/lib/db";
import { pollInbox } from "@/lib/api/inbox";
import { inboxHealth } from "@/lib/api/inbox-health";
import { readMailStatus } from "@/lib/api/mail";
import { readImapStatus } from "@/lib/api/imap";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Le relevé de la boîte de réception : son interrupteur, et son bouton.
 *
 * `PATCH` règle, `POST` relève **maintenant**. Le bouton n'est pas un
 * pis-aller : Railway n'expose pas de terminal, et c'est le seul moyen de
 * savoir si les identifiants passent sans attendre le prochain quart d'heure —
 * même raison que « Tester la copie » du jalon 37.
 *
 * `POST` et non `GET` : la route ouvre une session IMAP et peut écrire des
 * interactions. Une route qui produit un effet ne doit pas répondre à un
 * préchargement de navigateur.
 */
const schema = z.object({ inboxPollEnabled: z.boolean() });

export async function PATCH(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    await prisma.settings.upsert({
      where: { id: "singleton" },
      update: parsed.data,
      create: { id: "singleton", ...parsed.data },
    });
    return jsonOk({ health: await currentHealth() });
  } catch (error) {
    return serverError("PATCH /api/mail/inbox", error);
  }
}

export async function POST() {
  try {
    const report = await pollInbox();
    return jsonOk({ report, health: await currentHealth() });
  } catch (error) {
    return serverError("POST /api/mail/inbox", error);
  }
}

async function currentHealth() {
  const mail = await readMailStatus();
  const imap = await readImapStatus(mail, mail.passwordSet);
  return inboxHealth(imap.ready);
}
