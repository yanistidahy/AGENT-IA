import "server-only";

import { prisma } from "../db";
import { contactTitle } from "../domain/contact-identity";
import { REAL_ACTIVITY } from "./real-activity";

/**
 * **Le compte, pas la personne.**
 *
 * Une campagne qui écrit à plusieurs personnes d'une même maison a besoin de
 * trois faits que la fiche seule ne porte pas : qui d'autre est déjà en base,
 * qui a déjà reçu un message, et quand. Sans eux, deux collègues reçoivent la
 * même phrase d'ouverture à trois jours d'intervalle, se la montrent, et le
 * publipostage se voit.
 *
 * Ces lectures vivent **hors de `listContacts`**, délibérément : la liste est
 * un chemin chaud rendu pour cent cinquante lignes, et y joindre les collègues
 * de chacun coûterait une requête par ligne pour une information que seuls le
 * tiroir et le panneau de rédaction affichent.
 */

/** Un collègue déjà en base, tel que la fiche et la rédaction le montrent. */
export interface Colleague {
  readonly id: string;
  /** Le nom d'affichage — passe par `contactTitle`, donc jamais vide. */
  readonly name: string;
  /** Sa fonction telle qu'elle a été importée. Vide = non renseignée. */
  readonly title: string;
  readonly email: string;
  /** Dernier email que **nous** lui avons envoyé. `null` = jamais écrit. */
  readonly lastEmailAt: Date | null;
  /** Objet de ce dernier message — de quoi ne pas répéter la même accroche. */
  readonly lastSubject: string;
  /** Première ligne de ce message, pour qu'Alex sache quoi ne pas réutiliser. */
  readonly lastOpening: string;
}

/** La première ligne non vide d'un corps de message. */
function openingLine(body: string): string {
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    // L'appel (« Bonjour Camille, ») est la même formule partout : ce n'est pas
    // elle qu'on cherche à ne pas répéter, c'est la phrase qui suit.
    if (trimmed === "" || /^bonjour\b/i.test(trimmed)) continue;
    return trimmed;
  }
  return "";
}

/**
 * Les collègues d'un contact — mêmes société, fiche courante exclue.
 *
 * Une fiche sans société n'a pas de collègues : elle rend une liste vide, et
 * non toutes les fiches sans société, qui ne forment pas une maison.
 */
export async function readColleagues(contactId: string): Promise<readonly Colleague[]> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { companyId: true },
  });
  if (contact?.companyId == null) return [];

  const rows = await prisma.contact.findMany({
    where: { companyId: contact.companyId, id: { not: contactId } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      title: true,
      email: true,
      instagram: true,
      lastEmailAt: true,
      company: { select: { name: true } },
      emailSends: {
        select: { subject: true, body: true, sentAt: true },
        orderBy: { sentAt: "desc" },
        take: 1,
      },
    },
    orderBy: [{ lastEmailAt: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
  });

  return rows.map((row) => {
    const last = row.emailSends[0];
    return {
      id: row.id,
      name: contactTitle(row),
      title: row.title,
      email: row.email,
      lastEmailAt: row.lastEmailAt,
      lastSubject: last?.subject ?? "",
      lastOpening: last === undefined ? "" : openingLine(last.body),
    };
  });
}

/** Un collègue écrit récemment — la matière de l'avertissement. */
export interface ColleagueContact {
  readonly colleague: Colleague;
  readonly at: Date;
  readonly days: number;
}

export interface ColleagueWarning {
  /** Le plus récemment écrit : c'est celui dont le message sera comparé. */
  readonly recent: ColleagueContact | null;
  /** Tous les collègues, écrits ou non — le tiroir les affiche tous. */
  readonly colleagues: readonly Colleague[];
  /** La fenêtre appliquée, en jours. `0` = avertissement désactivé. */
  readonly windowDays: number;
}

/**
 * Un collègue a-t-il été écrit dans les N derniers jours ?
 *
 * **Un avertissement, jamais un blocage.** Écrire à deux personnes d'une même
 * maison est une intention parfaitement légitime — c'est même la forme de
 * campagne que ce jalon sert. Ce qui fait écrire une bêtise, c'est de ne pas
 * le savoir. Le refuser à la place de l'utilisateur serait décider pour lui,
 * ce que le produit s'interdit depuis le jalon 8.
 *
 * `windowDays` à 0 coupe l'avertissement — sans cette convention on ne pourrait
 * plus le désactiver une fois posé (même règle que le plafond mensuel de l'API
 * et les objectifs hebdomadaires).
 */
export async function readColleagueWarning(
  contactId: string,
  windowDays: number,
  now: Date = new Date(),
): Promise<ColleagueWarning> {
  const colleagues = await readColleagues(contactId);
  if (windowDays <= 0) return { recent: null, colleagues, windowDays };

  const limit = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  let recent: ColleagueContact | null = null;

  for (const colleague of colleagues) {
    const at = colleague.lastEmailAt;
    if (at === null || at < limit) continue;
    const days = Math.floor((now.getTime() - at.getTime()) / (24 * 60 * 60 * 1000));
    if (recent === null || at > recent.at) recent = { colleague, at, days };
  }

  return { recent, colleagues, windowDays };
}

/**
 * La fenêtre d'avertissement réglée, en jours.
 *
 * Lue ici plutôt que passée depuis les écrans : les deux appelants — le panneau
 * de rédaction et le dossier d'Alex — doivent voir la **même** valeur, et deux
 * lectures indépendantes finiraient par diverger le jour où l'une d'elles
 * oublierait de la rafraîchir.
 */
export async function readColleagueWindow(): Promise<number> {
  const settings = await prisma.settings.findUnique({
    where: { id: "singleton" },
    select: { colleagueWarningDays: true },
  });
  return settings?.colleagueWarningDays ?? 30;
}

/** Le dernier email envoyé à quiconque dans cette maison. */
export interface CompanyLastEmail {
  readonly at: Date;
  readonly contactId: string | null;
  readonly contactName: string;
  readonly subject: string;
  readonly signatoryName: string;
}

/**
 * Le dernier message envoyé au compte, quel que soit son destinataire.
 *
 * C'est le fait qui manque quand on ouvre une fiche société avant d'écrire :
 * « on leur a déjà parlé, il y a quatre jours, et c'est Mohamed qui a écrit ».
 * Lu depuis `email_sends`, jamais depuis les interactions : celles-ci mêlent
 * appels, notes et corrections, et l'on cherche ici un envoi.
 */
export async function readCompanyLastEmail(companyId: string): Promise<CompanyLastEmail | null> {
  const send = await prisma.emailSend.findFirst({
    where: { contact: { companyId } },
    select: {
      sentAt: true,
      subject: true,
      signatoryName: true,
      contactId: true,
      contact: { select: { firstName: true, lastName: true, company: { select: { name: true } } } },
    },
    orderBy: { sentAt: "desc" },
  });
  if (send === null) return null;

  return {
    at: send.sentAt,
    contactId: send.contactId,
    contactName: send.contact === null ? "fiche supprimée" : contactTitle(send.contact),
    subject: send.subject,
    signatoryName: send.signatoryName,
  };
}

/**
 * Le dernier échange **consigné** avec quiconque du compte, tous canaux.
 *
 * Distinct du précédent : un appel ou un DM engagent la maison autant qu'un
 * email, et quelqu'un qui a eu la fondatrice au téléphone hier ne doit pas
 * écrire à sa collègue comme à un compte froid. Les notes de correction sont
 * exclues, comme partout où l'on mesure une activité (jalon 27).
 */
export async function readCompanyLastActivity(companyId: string): Promise<Date | null> {
  const activity = await prisma.activity.findFirst({
    where: { ...REAL_ACTIVITY, contact: { companyId } },
    select: { date: true },
    orderBy: { date: "desc" },
  });
  return activity?.date ?? null;
}
