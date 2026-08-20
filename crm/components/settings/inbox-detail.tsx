"use client";

/**
 * Le détail d'un relevé, message par message.
 *
 * **« 9 examinés, 0 rapproché » ne se diagnostique pas.** Il faut savoir
 * lesquels et pourquoi : quel message ne cite aucun fil, lequel a été écarté
 * comme automate et sur quel en-tête, et contre quoi le rapprochement a
 * échoué. Ce tableau existe pour cette question et disparaît avec elle — rien
 * n'est enregistré en base.
 *
 * Ce qu'il montre reste des **en-têtes de fil** : aucun sujet reçu, aucun
 * expéditeur, aucun mot du corps. La promesse du jalon 41 tient jusque dans
 * l'écran de diagnostic.
 */
export interface ExaminedMessage {
  messageId: string;
  inReplyTo: string;
  references: string;
  verdict: "reply" | "auto" | "bounce" | "unrelated";
  autoHeader: string;
  matchedId: string;
  tried: string[];
  oursMissing: boolean;
}

export interface PollDetail {
  messages: ExaminedMessage[];
  knownSent: number;
  searchSince: string | null;
  mailbox: string;
  sendingDomain: string;
}

const VERDICTS: Record<ExaminedMessage["verdict"], { label: string; tone: string }> = {
  reply: { label: "Réponse", tone: "bg-win-l text-win-d" },
  auto: { label: "Automate", tone: "bg-gold-l text-[#9A6410]" },
  bounce: { label: "Rebond", tone: "bg-gold-l text-[#9A6410]" },
  unrelated: { label: "Sans rapport", tone: "bg-surface-2 text-muted" },
};

/** Le ton d'un « sans rapport » qui accuse en fait la base, pas la boîte. */
const OURS_MISSING_TONE = "bg-[#FBE3E3] text-[#A32C2C]";

/** Pourquoi ce message n'est pas devenu une réponse, en une phrase. */
function why(message: ExaminedMessage): string {
  if (message.verdict === "reply") return `Rapproché de ${message.matchedId}`;
  if (message.verdict === "auto") return `Écarté sur l'en-tête ${message.autoHeader}`;
  if (message.verdict === "bounce") return "Écarté : avis de non-remise";
  if (message.tried.length === 0) {
    return "Ne cite aucun fil : ni In-Reply-To ni References. Ce n'est pas une réponse à un message identifié.";
  }
  // **Deux phrases, parce que ce sont deux pannes différentes.** « Fil inconnu »
  // décrit une boîte de réception ordinaire ; « identifiant de notre domaine
  // absent de la base » décrit un journal d'envois faux, et se répare par le
  // rattrapage depuis « Envoyés ». Les confondre a coûté trois relevés.
  if (message.oursMissing) {
    return (
      `Cite un identifiant de NOTRE domaine, absent de la base : ${message.tried.join(" ")}. ` +
      `Le fil est correct — c'est le journal des envois qui ne porte pas cet identifiant. ` +
      `Lancez « Rattraper depuis « Envoyés » » ci-dessous.`
    );
  }
  return `Aucun de ces identifiants n'est des nôtres : ${message.tried.join(" ")}`;
}

export function InboxDetail({ detail }: { readonly detail: PollDetail }) {
  const since = detail.searchSince === null ? null : new Date(detail.searchSince);

  return (
    <div className="mt-3 rounded-card border border-line bg-surface-2 p-3">
      <p className="text-[11.5px] text-muted">
        Boîte relevée : <b className="font-semibold text-ink">{detail.mailbox || "—"}</b> ·{" "}
        {detail.knownSent} identifiant{detail.knownSent > 1 ? "s" : ""} d'envoi connu
        {detail.knownSent > 1 ? "s" : ""} ·{" "}
        {since === null
          ? "fenêtre non déterminée"
          : `messages depuis le ${since.toLocaleDateString("fr-FR")}`}
      </p>
      {detail.mailbox !== "" && (
        <p className="mt-1 text-[11px] text-muted">
          C'est la boîte de <b className="font-semibold text-ink">l'identifiant IMAP</b>. Si
          votre adresse d'expédition est un alias posé sur une autre boîte, c'est l'autre qui
          est relevée, et aucune réponse n'y arrivera.
        </p>
      )}

      {detail.messages.length === 0 ? (
        <p className="mt-2 text-[12px] text-muted">Aucun message dans la fenêtre.</p>
      ) : (
        <div className="mt-2 max-h-[40vh] overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Verdict", "Message-ID reçu", "Pourquoi"].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="border-b border-line px-2 py-1 text-left font-mono text-[9.5px] tracking-[0.1em] text-muted uppercase"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detail.messages.map((message, index) => (
                <tr key={`${message.messageId}-${index}`}>
                  <td className="border-b border-line-2 px-2 py-1 align-top">
                    <span
                      className={`rounded-full px-1.5 py-[1px] text-[10.5px] font-medium ${
                        message.oursMissing
                          ? OURS_MISSING_TONE
                          : VERDICTS[message.verdict].tone
                      }`}
                    >
                      {message.oursMissing
                        ? "Notre identifiant, absent"
                        : VERDICTS[message.verdict].label}
                    </span>
                  </td>
                  <td className="max-w-[22ch] truncate border-b border-line-2 px-2 py-1 align-top font-mono text-[10.5px] text-muted">
                    {message.messageId || "(absent)"}
                  </td>
                  <td className="border-b border-line-2 px-2 py-1 align-top text-[11px] break-words text-muted">
                    {why(message)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-2 text-[11px] text-muted">
        Ce détail n'est pas enregistré : il vit le temps de cette réponse. Seuls des en-têtes
        de fil y figurent — aucun sujet reçu, aucun expéditeur, aucun mot du message.
      </p>
    </div>
  );
}
