/**
 * Rapprocher un message du dossier « Envoyés » de la ligne d'envoi qui le décrit.
 *
 * **Le dossier « Envoyés » est la seule copie fidèle de ce qui est réellement
 * parti.** Quand `email_sends.messageId` est faux — c'est le défaut du jalon 44
 * — c'est là, et nulle part ailleurs, que le vrai identifiant se trouve.
 *
 * ## Ce qui sert de clé, et ce qui n'en sert pas
 *
 * | Champ | Rôle |
 * |---|---|
 * | destinataire | **clé** — normalisé, casse et chevrons retirés |
 * | date d'envoi | **clé** — à {@link MATCH_TOLERANCE_SECONDS} près |
 * | sujet | **confirmation seulement** — voir plus bas |
 * | `Message-ID` | ce qu'on veut écrire, jamais ce sur quoi on rapproche |
 *
 * Le sujet ne sert pas de clé parce qu'il arrive **encodé** (`=?UTF-8?Q?…`)
 * dans les en-têtes : le décoder pour comparer ajouterait une source d'erreur
 * là où le couple destinataire + instant suffit déjà à identifier un message.
 * Deux messages au même destinataire à deux minutes d'intervalle n'existent
 * pas dans ce produit — les séquences espacent de plusieurs jours.
 *
 * ## L'ambiguïté est signalée, jamais tranchée
 *
 * **Écrire un mauvais `Message-ID` est pire que de n'en écrire aucun** : le
 * rapprochement des réponses attribuerait alors une réponse à la mauvaise
 * personne, et arrêterait la mauvaise séquence. Toute correspondance multiple
 * — d'un côté ou de l'autre — est donc rendue comme `ambiguous` et laissée à
 * l'humain. C'est la même règle qu'au jalon 41 : une fausse correspondance
 * coûte plus cher qu'une réponse manquée.
 *
 * Module pur : la règle se teste sans IMAP ni base.
 */

/** Écart maximal admis entre la date de l'en-tête et `sentAt`. */
export const MATCH_TOLERANCE_SECONDS = 120;

/** Une ligne `email_sends`, réduite à ce qui sert au rapprochement. */
export interface SendLike {
  readonly id: string;
  readonly toAddress: string;
  readonly sentAt: Date;
  readonly messageId: string;
  readonly subject: string;
}

/** Un message lu dans « Envoyés », en-têtes seuls. */
export interface SentHeaderLike {
  readonly messageId: string;
  readonly to: string;
  readonly date: Date | null;
}

export type MatchOutcome =
  /** Un seul candidat des deux côtés : la correction est sûre. */
  | {
      readonly kind: "matched";
      readonly sendId: string;
      readonly from: string;
      readonly to: string;
    }
  /** L'identifiant en base est déjà le bon : rien à faire. */
  | { readonly kind: "already"; readonly sendId: string }
  /** Plusieurs candidats : signalé, jamais deviné. */
  | { readonly kind: "ambiguous"; readonly reason: string; readonly candidates: number }
  /** Aucun envoi ne correspond — un message écrit à la main depuis la boîte. */
  | { readonly kind: "unknown" };

/**
 * L'adresse, réduite à ce qui l'identifie.
 *
 * `"Caroline Lanson <Caroline@Miye.Care>"` et `"caroline@miye.care"` désignent
 * la même personne : comparer les chaînes brutes ferait échouer un
 * rapprochement pourtant évident.
 */
export function normalizeAddress(raw: string): string {
  const angled = /<([^<>]+)>/.exec(raw);
  return (angled?.[1] ?? raw).trim().toLowerCase();
}

function withinTolerance(a: Date, b: Date): boolean {
  return Math.abs(a.getTime() - b.getTime()) <= MATCH_TOLERANCE_SECONDS * 1000;
}

/**
 * Rapproche **un** message de la liste des envois.
 *
 * `sends` est la liste entière : c'est elle qui permet de détecter qu'un
 * message correspond à deux lignes, ce qu'un filtrage préalable masquerait.
 */
export function matchSentMessage(
  header: SentHeaderLike,
  sends: readonly SendLike[],
): MatchOutcome {
  const id = header.messageId.trim();
  if (id === "" || header.date === null) {
    return { kind: "ambiguous", reason: "en-têtes incomplets dans « Envoyés »", candidates: 0 };
  }

  // Déjà correct : le cas le plus fréquent une fois le rattrapage passé, et le
  // seul qui permette de rejouer l'action sans rien réécrire.
  const exact = sends.find((send) => send.messageId === id);
  if (exact !== undefined) return { kind: "already", sendId: exact.id };

  const to = normalizeAddress(header.to);
  const candidates = sends.filter(
    (send) =>
      normalizeAddress(send.toAddress) === to &&
      header.date !== null &&
      withinTolerance(send.sentAt, header.date),
  );

  if (candidates.length === 0) return { kind: "unknown" };
  if (candidates.length > 1) {
    return {
      kind: "ambiguous",
      reason: `${candidates.length} envois au même destinataire à moins de ${MATCH_TOLERANCE_SECONDS} s`,
      candidates: candidates.length,
    };
  }

  const send = candidates[0];
  if (send === undefined) return { kind: "unknown" };
  return { kind: "matched", sendId: send.id, from: send.messageId, to: id };
}

export interface PlannedFix {
  readonly sendId: string;
  readonly subject: string;
  readonly toAddress: string;
  readonly sentAt: Date;
  /** Ce que la base porte aujourd'hui. Vide si la colonne n'a jamais été écrite. */
  readonly stored: string;
  /** Ce que le dossier « Envoyés » prouve. */
  readonly real: string;
}

export interface BackfillPlan {
  readonly fixes: readonly PlannedFix[];
  readonly already: number;
  readonly unknown: number;
  readonly ambiguous: readonly string[];
  readonly examined: number;
}

/**
 * Le plan complet, avant toute écriture.
 *
 * **Un envoi ne peut être corrigé qu'une fois.** Si deux messages du dossier
 * revendiquent la même ligne — un renvoi, un doublon d'archive — la ligne est
 * déclarée ambiguë et retirée du plan plutôt que corrigée deux fois avec deux
 * valeurs différentes, ce qui ferait dépendre le résultat de l'ordre de lecture.
 */
export function planBackfill(
  headers: readonly SentHeaderLike[],
  sends: readonly SendLike[],
): BackfillPlan {
  const byId = new Map<string, SendLike>(sends.map((send) => [send.id, send]));
  const claimed = new Map<string, string[]>();
  const ambiguous: string[] = [];
  let already = 0;
  let unknown = 0;

  for (const header of headers) {
    const outcome = matchSentMessage(header, sends);
    if (outcome.kind === "already") already += 1;
    else if (outcome.kind === "unknown") unknown += 1;
    else if (outcome.kind === "ambiguous") {
      ambiguous.push(`${header.messageId || "(sans Message-ID)"} — ${outcome.reason}`);
    } else {
      const list = claimed.get(outcome.sendId) ?? [];
      list.push(outcome.to);
      claimed.set(outcome.sendId, list);
    }
  }

  const fixes: PlannedFix[] = [];
  for (const [sendId, ids] of claimed) {
    const send = byId.get(sendId);
    if (send === undefined) continue;
    if (ids.length > 1) {
      ambiguous.push(
        `${send.subject} → ${ids.length} messages de « Envoyés » revendiquent le même envoi`,
      );
      continue;
    }
    const real = ids[0];
    if (real === undefined) continue;
    fixes.push({
      sendId,
      subject: send.subject,
      toAddress: send.toAddress,
      sentAt: send.sentAt,
      stored: send.messageId,
      real,
    });
  }

  return { fixes, already, unknown, ambiguous, examined: headers.length };
}
