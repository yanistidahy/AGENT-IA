/**
 * Classer un message de la boîte de réception — la part pure du relevé.
 *
 * **La correspondance est exacte, ou elle n'est pas.** Une réponse se reconnaît
 * à ses en-têtes `In-Reply-To` et `References`, comparés aux `Message-ID` que
 * *nous* avons émis. Aucune heuristique sur l'adresse de l'expéditeur ni sur le
 * sujet : une fausse correspondance consignerait une réponse sur la mauvaise
 * fiche et arrêterait la mauvaise séquence — pire qu'une réponse manquée, qui
 * ne coûte qu'un relevé de retard sur la saisie manuelle.
 *
 * **En-têtes seulement.** Ce module ne voit jamais un corps de message ; la
 * boîte n'est pas miroir dans le CRM, et c'est une exigence, pas une économie.
 */

export interface InboxHeaders {
  /** Le Message-ID du message reçu — la clé d'idempotence du relevé. */
  readonly messageId: string;
  readonly inReplyTo: string;
  readonly references: string;
  readonly autoSubmitted: string;
  readonly xAutoreply: string;
  readonly from: string;
  readonly date: Date | null;
}

/**
 * Le verdict, **et ce qui l'a produit**.
 *
 * Un verdict sans motif ne se diagnostique pas : « 9 messages examinés, 0
 * rapproché » ne dit ni lesquels, ni pourquoi. Chaque branche porte donc sa
 * raison — l'en-tête qui a fait écarter un automate, les identifiants qui ont
 * été essayés quand rien n'a correspondu.
 */
export type Classification =
  | { readonly kind: "reply"; readonly matchedId: string }
  /** `header` nomme l'en-tête qui a tranché : `Auto-Submitted` ou `X-Autoreply`. */
  | { readonly kind: "auto"; readonly header: string; readonly value: string }
  | { readonly kind: "bounce" }
  /** Les identifiants essayés, dans l'ordre : vide = le message ne cite aucun fil. */
  | { readonly kind: "unrelated"; readonly tried: readonly string[] };

/**
 * Les message-ids d'un en-tête, chevrons compris.
 *
 * `References` en porte plusieurs, séparés par des espaces ou des sauts de
 * ligne pliés ; `In-Reply-To` en porte en principe un. Le format est le même :
 * `<identifiant@domaine>`. Tout ce qui n'a pas cette forme est ignoré — un
 * en-tête malformé ne doit pas fabriquer une correspondance.
 */
export function extractMessageIds(header: string): readonly string[] {
  const matches = header.match(/<[^<>\s]+@[^<>\s]+>/g);
  return matches === null ? [] : matches;
}

/**
 * Ce message est-il produit par une machine ?
 *
 * `Auto-Submitted` (RFC 3834) vaut `no` sur un message écrit par un humain ;
 * toute autre valeur non vide — `auto-replied`, `auto-generated` — désigne un
 * répondeur ou un système. `X-Autoreply` est la variante non normalisée que
 * certains serveurs posent. Un « absent du bureau » compté comme réponse
 * arrêterait une séquence pour un message que personne n'a lu.
 *
 * **Deux en-têtes, et deux seulement.** Ni `List-Unsubscribe`, ni `Precedence`,
 * ni la présence d'images ou de liens : une signature commerciale riche est
 * écrite par un humain, et l'écarter perdrait exactement les réponses qui
 * comptent. Le relevé ne demande d'ailleurs pas ces en-têtes au serveur — ils
 * ne peuvent donc pas influencer le verdict, même par accident.
 */
export function autoResponseHeader(
  headers: Pick<InboxHeaders, "autoSubmitted" | "xAutoreply">,
): { readonly header: string; readonly value: string } | null {
  const auto = headers.autoSubmitted.trim();
  if (auto !== "" && auto.toLowerCase() !== "no") {
    return { header: "Auto-Submitted", value: auto };
  }
  const legacy = headers.xAutoreply.trim();
  if (legacy !== "") return { header: "X-Autoreply", value: legacy };
  return null;
}

export function isAutoResponse(headers: Pick<InboxHeaders, "autoSubmitted" | "xAutoreply">): boolean {
  return autoResponseHeader(headers) !== null;
}

/**
 * Ce message est-il un avis de non-remise ?
 *
 * Un rebond vient du **serveur**, pas du destinataire : `MAILER-DAEMON` ou
 * `postmaster` en expéditeur. C'est un test sur la nature de l'émetteur — une
 * machine de messagerie — pas une heuristique de rapprochement : il ne sert
 * jamais à attribuer le message à une fiche, seulement à l'écarter.
 */
export function isBounce(headers: Pick<InboxHeaders, "from">): boolean {
  const from = headers.from.toLowerCase();
  return from.includes("mailer-daemon") || from.includes("postmaster@");
}

/**
 * Le verdict, dans l'ordre où les règles priment.
 *
 * L'automate passe avant la correspondance : un répondeur d'absence cite
 * fidèlement nos en-têtes — `In-Reply-To` correspondrait — et c'est précisément
 * pour cela qu'il faut l'écarter d'abord. Un rebond aussi : il porte souvent
 * nos identifiants dans `References`.
 */
export function classify(
  headers: InboxHeaders,
  knownSentIds: ReadonlySet<string>,
): Classification {
  const auto = autoResponseHeader(headers);
  if (auto !== null) return { kind: "auto", header: auto.header, value: auto.value };
  if (isBounce(headers)) return { kind: "bounce" };

  // `In-Reply-To` d'abord : c'est le message auquel on répond directement.
  // `References` ensuite, **du plus récent au plus ancien** — le dernier de la
  // liste est le message répondu, les précédents sont le fil remonté.
  const candidates = [
    ...extractMessageIds(headers.inReplyTo),
    ...[...extractMessageIds(headers.references)].reverse(),
  ];
  for (const candidate of candidates) {
    if (knownSentIds.has(candidate)) return { kind: "reply", matchedId: candidate };
  }
  return { kind: "unrelated", tried: candidates };
}
