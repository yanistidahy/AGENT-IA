import "server-only";
import { z } from "zod";

import { prisma } from "../db";

/**
 * **Les boîtes d'envoi : trois adresses, trois signatures, un seul module.**
 *
 * La configuration unique du jalon 32 devient une liste. Chaque boîte porte son
 * SMTP, son IMAP (copie « Envoyés » et relevé des réponses — même boîte, même
 * secret, jalon 37) et sa signature : choisir la boîte choisit la signature,
 * c'est ce qui remplace le sélecteur de signataire du jalon 35.
 *
 * ## Le mot de passe : par slug, jamais en base
 *
 * `SMTP_PASSWORD_<SLUG>` — slug en majuscules, tout ce qui n'est pas
 * alphanumérique devient `_`. Le slug est **immuable** (comme celui des agents,
 * jalon 15) : il indexe une variable d'environnement, et le rendre modifiable
 * transformerait un renommage d'étiquette en panne d'authentification. Le
 * libellé, lui, se renomme librement.
 *
 * La boîte migrée depuis la configuration du jalon 32 porte le slug
 * `principale`, et son mot de passe **retombe sur `SMTP_PASSWORD`** quand
 * `SMTP_PASSWORD_PRINCIPALE` n'est pas posée : le déploiement en cours continue
 * d'envoyer sans qu'on touche à Railway. Ce repli est réservé à cette boîte —
 * l'étendre aux autres ferait authentifier la boîte de Mohamed avec le mot de
 * passe de Yanis, et l'erreur ne se verrait qu'au refus du serveur.
 */

export interface Mailbox {
  readonly id: string;
  readonly slug: string;
  readonly label: string;
  readonly position: number;
  readonly active: boolean;
  readonly smtpHost: string;
  readonly smtpPort: number;
  readonly smtpEncryption: "tls" | "starttls";
  readonly smtpUser: string;
  readonly smtpFrom: string;
  readonly smtpFromName: string;
  readonly imapHost: string;
  readonly imapPort: number;
  readonly imapEncryption: string;
  readonly imapSentMailbox: string;
  readonly imapCopyEnabled: boolean;
  readonly signName: string;
  readonly signTitle: string;
}

/** Le slug de la boîte migrée du jalon 32 — la seule au repli `SMTP_PASSWORD`. */
export const LEGACY_SLUG = "principale";
export const LEGACY_PASSWORD_ENV = "SMTP_PASSWORD";

/** Le nom de la variable d'environnement qui porte le mot de passe d'un slug. */
export function passwordEnvFor(slug: string): string {
  return `SMTP_PASSWORD_${slug.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
}

/**
 * Le mot de passe d'une boîte — jamais lu ailleurs qu'ici, jamais rendu à un
 * écran. Vide = non configuré, et c'est l'appelant qui le dit à l'utilisateur
 * en nommant la variable (`passwordEnvFor`).
 */
export function mailboxPassword(mailbox: Pick<Mailbox, "slug">): string {
  const keyed = process.env[passwordEnvFor(mailbox.slug)];
  if (keyed !== undefined && keyed !== "") return keyed;
  if (mailbox.slug === LEGACY_SLUG) return process.env[LEGACY_PASSWORD_ENV] ?? "";
  return "";
}

function toEncryption(value: string): "tls" | "starttls" {
  return value === "tls" ? "tls" : "starttls";
}

const mailboxSelect = {
  id: true,
  slug: true,
  label: true,
  position: true,
  active: true,
  smtpHost: true,
  smtpPort: true,
  smtpEncryption: true,
  smtpUser: true,
  smtpFrom: true,
  smtpFromName: true,
  imapHost: true,
  imapPort: true,
  imapEncryption: true,
  imapSentMailbox: true,
  imapCopyEnabled: true,
  signName: true,
  signTitle: true,
} as const;

function toMailbox(row: {
  [K in keyof typeof mailboxSelect]: K extends "smtpEncryption"
    ? string
    : K extends keyof Mailbox
      ? Mailbox[K] extends "tls" | "starttls"
        ? string
        : Mailbox[K]
      : never;
}): Mailbox {
  return { ...row, smtpEncryption: toEncryption(row.smtpEncryption) };
}

export async function listMailboxes(): Promise<Mailbox[]> {
  const rows = await prisma.mailbox.findMany({
    orderBy: [{ position: "asc" }, { label: "asc" }],
    select: mailboxSelect,
  });
  return rows.map(toMailbox);
}

/** Une boîte telle que l'écran la montre : + la variable du secret, et son état. */
export interface MailboxView extends Mailbox {
  readonly passwordEnv: string;
  readonly passwordSet: boolean;
}

export async function listMailboxViews(): Promise<MailboxView[]> {
  return (await listMailboxes()).map((box) => ({
    ...box,
    passwordEnv: passwordEnvFor(box.slug),
    passwordSet: mailboxPassword(box) !== "",
  }));
}

export async function getMailbox(id: string): Promise<Mailbox | null> {
  const row = await prisma.mailbox.findUnique({ where: { id }, select: mailboxSelect });
  return row === null ? null : toMailbox(row);
}

/**
 * La boîte par défaut : la première active.
 *
 * Les chemins qui n'ont pas encore de choix explicite — les rédactions lancées
 * sans campagne, notamment — partent de là ; l'écran laisse ensuite changer.
 */
export async function defaultMailbox(): Promise<Mailbox | null> {
  const boxes = await listMailboxes();
  return boxes.find((box) => box.active) ?? boxes[0] ?? null;
}

/**
 * La boîte proposée pour un contact : celle dont le signataire est le
 * propriétaire de la fiche.
 *
 * C'est `pickSignatory` du jalon 35, transposé : si « Yanis » suit ce prospect,
 * c'est sa boîte qui écrit. Comparaison en mots entiers — « Marc » ne
 * correspond pas à « Marceau ».
 */
/**
 * Le propriétaire d'une fiche correspond-il à ce signataire ?
 *
 * En **mots entiers** : « Marc » ne correspond pas à « Marceau ». Partagée par
 * `pickMailbox` et `pickSignatory` — deux copies de cette règle divergeraient,
 * et l'envoi partirait sous la mauvaise identité sans que rien ne le dise.
 */
export function ownerMatches(signName: string, owner: string): boolean {
  const needle = owner.trim().toLowerCase();
  if (needle === "") return false;
  const name = signName.toLowerCase();
  return name === needle || name.split(/\s+/).includes(needle);
}

export function pickMailbox(mailboxes: readonly Mailbox[], owner: string): Mailbox | null {
  const active = mailboxes.filter((box) => box.active);
  const pool = active.length > 0 ? active : mailboxes;
  if (pool.length === 0) return null;

  return pool.find((box) => ownerMatches(box.signName, owner)) ?? pool[0] ?? null;
}

/** Un slug depuis un libellé : minuscules, sans accents, tirets. */
export function slugFor(label: string): string {
  const base = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base === "" ? "boite" : base;
}

export const mailboxesSchema = z.object({
  mailboxes: z
    .array(
      z.object({
        /** Absent = création. Présent = mise à jour de la boîte existante. */
        id: z.string().optional(),
        label: z.string().trim().min(1, "Le libellé ne peut pas être vide").max(80),
        active: z.boolean(),
        smtpHost: z.string().trim().max(200),
        smtpPort: z.number().int().min(1).max(65535),
        smtpEncryption: z.enum(["tls", "starttls"], { error: "Mode de chiffrement inconnu" }),
        smtpUser: z.string().trim().max(200),
        smtpFrom: z.union([z.literal(""), z.email("Adresse d'expédition invalide")]),
        smtpFromName: z.string().trim().max(120),
        imapHost: z.string().trim().max(200),
        imapPort: z.number().int().min(1).max(65535),
        imapSentMailbox: z.string().trim().max(200),
        imapCopyEnabled: z.boolean(),
        signName: z.string().trim().max(120),
        signTitle: z.string().trim().max(160),
      }),
    )
    .min(1, "Il faut au moins une boîte")
    .max(10),
});

export type MailboxesInput = z.infer<typeof mailboxesSchema>;

export type SaveMailboxesResult =
  | { readonly ok: true; readonly mailboxes: readonly Mailbox[] }
  | { readonly ok: false; readonly message: string };

/**
 * Enregistre la liste des boîtes.
 *
 * **Pas un « vider puis recréer »** comme les signataires du jalon 35 : une
 * boîte est référencée par des campagnes et des envois, et son slug indexe une
 * variable d'environnement. Les boîtes existantes sont mises à jour par
 * identifiant (slug intact), les nouvelles créées avec un slug dérivé du
 * libellé et uniquifié, et une boîte retirée de la liste n'est supprimée que si
 * **aucune campagne** ne la tient — sinon le refus nomme la campagne, parce
 * qu'une campagne dont la boîte disparaît est une campagne qui ne peut plus
 * envoyer, en silence.
 */
export async function saveMailboxes(input: MailboxesInput): Promise<SaveMailboxesResult> {
  const existing = await prisma.mailbox.findMany({ select: { id: true, slug: true } });
  const known = new Set(existing.map((row) => row.id));
  const keptIds = new Set(input.mailboxes.map((box) => box.id).filter((id) => id !== undefined));

  for (const box of input.mailboxes) {
    if (box.id !== undefined && !known.has(box.id)) {
      return { ok: false, message: "Une des boîtes envoyées n'existe plus. Rechargez la page." };
    }
  }

  const removed = existing.filter((row) => !keptIds.has(row.id));
  for (const row of removed) {
    const campaign = await prisma.campaign.findFirst({
      where: { mailboxId: row.id },
      select: { name: true },
    });
    if (campaign !== null) {
      return {
        ok: false,
        message:
          `La boîte « ${row.slug} » est utilisée par la campagne « ${campaign.name} » : ` +
          "changez d'abord la boîte de cette campagne, ou désactivez la boîte au lieu de la supprimer.",
      };
    }
  }

  const slugs = new Set(existing.map((row) => row.slug));

  await prisma.$transaction(async (tx) => {
    for (const row of removed) {
      await tx.mailbox.delete({ where: { id: row.id } });
    }

    for (const [index, box] of input.mailboxes.entries()) {
      const { id, ...data } = box;
      if (id !== undefined) {
        await tx.mailbox.update({ where: { id }, data: { ...data, position: index } });
        continue;
      }

      // Slug uniquifié par suffixe numérique : deux boîtes « Mohamed » donnent
      // `mohamed` puis `mohamed-2`, et chacune garde le sien pour toujours.
      let slug = slugFor(box.label);
      for (let n = 2; slugs.has(slug); n += 1) slug = `${slugFor(box.label)}-${n}`;
      slugs.add(slug);

      await tx.mailbox.create({ data: { ...data, slug, position: index } });
    }
  });

  return { ok: true, mailboxes: await listMailboxes() };
}
