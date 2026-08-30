import "server-only";
import { prisma } from "../db";
import {
  BURST_WINDOW_SECONDS,
  DELIVERY_WINDOW_SECONDS,
  noiseShare,
  type OpenHitKind,
} from "../domain/open-tracking";
import { contactTitle } from "../domain/contact-identity";

/**
 * À quoi ressemblent vraiment les chargements de pixel.
 *
 * **« 87 % des personnes ont ouvert » n'est pas une mesure tant qu'on ne peut
 * pas voir les lignes qui la produisent.** Ce module rend les faits bruts :
 * combien de chargements, quand après l'envoi, groupés comment, et combien
 * survivent au tri du jalon 43.
 *
 * Il ne rend **aucune adresse IP ni agent utilisateur** — ils ne sont pas
 * stockés. Un chargement, ici, c'est un envoi, un instant et un verdict.
 *
 * ## La limite à dire avant les chiffres
 *
 * Les chargements antérieurs au jalon 43 n'ont **jamais été enregistrés
 * ligne à ligne** : la table ne portait que `openCount`. Un envoi qui affiche
 * huit ouvertures sans aucune ligne de détail est donc **inauditable** — ni
 * confirmé, ni infirmé. C'est ce que compte `unclassified`, et c'est le premier
 * nombre que l'écran doit montrer : sans lui, on croirait que le tri a jugé
 * tout l'historique.
 */

export interface OpenHitRow {
  readonly at: Date;
  readonly delaySeconds: number;
  readonly kind: string;
  readonly subject: string;
  readonly contactName: string;
}

export interface OpenAudit {
  readonly windowDays: number;
  /** Envois suivis dans la fenêtre. */
  readonly tracked: number;
  /** Envois portant au moins un chargement compté. */
  readonly openedSends: number;
  /**
   * Envois dont le compteur est non nul sans aucune ligne de détail.
   *
   * Ce sont les envois d'avant le jalon 43 : leur chiffre n'a pas été trié.
   */
  readonly unclassified: number;
  readonly byKind: Readonly<Record<OpenHitKind, number>>;
  /** Part de bruit sur les chargements réellement classés. */
  readonly noiseRate: number | null;
  /** Répartition des délais depuis l'envoi, bornes en secondes. */
  readonly delays: readonly { readonly label: string; readonly count: number }[];
  /** Les derniers chargements, tels quels. */
  readonly rows: readonly OpenHitRow[];
  readonly deliveryWindowSeconds: number;
  readonly burstWindowSeconds: number;
}

const WINDOW_DAYS = 90;
const MAX_ROWS = 60;

const BUCKETS: readonly { readonly label: string; readonly max: number }[] = [
  { label: "moins de 30 s", max: DELIVERY_WINDOW_SECONDS },
  { label: "30 s – 5 min", max: 300 },
  { label: "5 min – 1 h", max: 3600 },
  { label: "1 h – 1 j", max: 86_400 },
  { label: "plus d'un jour", max: Number.POSITIVE_INFINITY },
];

export async function readOpenAudit(now = new Date()): Promise<OpenAudit> {
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);

  const sends = await prisma.emailSend.findMany({
    where: { sentAt: { gte: since }, tracked: true },
    orderBy: { sentAt: "desc" },
    select: {
      subject: true,
      openCount: true,
      contact: { select: { firstName: true, lastName: true } },
      hits: { orderBy: { at: "desc" }, select: { at: true, delaySeconds: true, kind: true } },
    },
  });

  const byKind: Record<OpenHitKind, number> = { counted: 0, burst: 0, delivery: 0 };
  const buckets = BUCKETS.map((bucket) => ({ label: bucket.label, count: 0 }));
  const rows: OpenHitRow[] = [];
  let openedSends = 0;
  let unclassified = 0;

  for (const send of sends) {
    const name = send.contact === null ? "" : contactTitle(send.contact);
    if (send.hits.length === 0) {
      // Un compteur sans ligne : le chiffre existe, la preuve n'existe pas.
      if (send.openCount > 0) unclassified += 1;
      continue;
    }

    let counted = 0;
    for (const hit of send.hits) {
      if (hit.kind === "counted" || hit.kind === "burst" || hit.kind === "delivery") {
        byKind[hit.kind] += 1;
        if (hit.kind === "counted") counted += 1;
      }

      const bucket = buckets[BUCKETS.findIndex((entry) => hit.delaySeconds < entry.max)];
      if (bucket !== undefined) bucket.count += 1;

      if (rows.length < MAX_ROWS) {
        rows.push({
          at: hit.at,
          delaySeconds: hit.delaySeconds,
          kind: hit.kind,
          subject: send.subject,
          contactName: name === "" ? "—" : name,
        });
      }
    }
    if (counted > 0) openedSends += 1;
  }

  const share = noiseShare(byKind.counted, byKind.burst + byKind.delivery);

  return {
    windowDays: WINDOW_DAYS,
    tracked: sends.length,
    openedSends,
    unclassified,
    byKind,
    noiseRate: share.noiseRate,
    delays: buckets,
    rows,
    deliveryWindowSeconds: DELIVERY_WINDOW_SECONDS,
    burstWindowSeconds: BURST_WINDOW_SECONDS,
  };
}
