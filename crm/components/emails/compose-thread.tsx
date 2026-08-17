"use client";

import { useEffect, useRef, useState } from "react";
import { useAgentChat } from "@/lib/client/use-agent-chat";
import { composeMessage, parseReply } from "@/lib/domain/draft-protocol";
import type { DraftVersion } from "./draft-revisions";

/**
 * **Une vraie conversation avec Alex, sous le brouillon.**
 *
 * Avant, on tapait une instruction et un brouillon revenait en silence : un
 * formulaire, pas un échange. On ne pouvait ni demander « pourquoi tu as écrit
 * ça ? », ni « qu'est-ce qu'on sait d'elle ? », ni « propose deux angles ».
 *
 * C'est le **même** `useAgentChat` que le panneau du rail — streaming, outils de
 * lecture du CRM, historique en base. Alex peut donc aller lire la chronologie
 * et la société pour répondre, sans qu'on ait rien à câbler ici.
 *
 * Ce qui distingue une réponse d'une reprise n'est pas un bouton mais la
 * **présence d'un bloc** dans sa réponse (voir `lib/domain/draft-protocol.ts`).
 * Une question laisse donc les champs strictement intacts.
 */
export function ComposeThread({
  contactId,
  contactName,
  subject,
  body,
  signature,
  onRevised,
}: {
  readonly contactId: string;
  readonly contactName: string;
  /** L'état courant des champs — retouches à la main comprises. */
  readonly subject: string;
  readonly body: string;
  /** Le signataire choisi : il voyage avec chaque demande. */
  readonly signature: string;
  readonly onRevised: (draft: DraftVersion, summary: string) => void;
}) {
  const [text, setText] = useState("");

  const chat = useAgentChat({ agentId: "alex" });

  // Le dernier tour appliqué : sans ce garde-fou, chaque rendu réappliquerait
  // le même brouillon et écraserait une retouche faite entre-temps.
  const applied = useRef(-1);

  /**
   * Appliquer le brouillon **à la fin du tour**, pas pendant.
   *
   * Le texte arrive par morceaux : extraire un bloc en cours de route
   * remplacerait le message par un fragment, puis par un autre fragment, sous
   * les yeux de l'utilisateur.
   */
  useEffect(() => {
    if (chat.streaming) return;

    const index = chat.items.length - 1;
    const last = chat.items[index];
    if (last === undefined || last.kind !== "agent" || index === applied.current) return;
    applied.current = index;

    const parsed = parseReply(last.text);
    if (parsed.draft === null) return;

    onRevised(
      { subject: parsed.draft.subject === "" ? subject : parsed.draft.subject, body: parsed.draft.body },
      parsed.message,
    );
  }, [chat.items, chat.streaming, onRevised, subject]);

  const send = () => {
    const instruction = text.trim();
    if (instruction === "" || chat.streaming) return;
    setText("");
    void chat.send(
      composeMessage({ id: contactId, name: contactName }, { subject, body }, instruction, signature),
    );
  };

  return (
    <div className="mt-4 border-t border-line pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[9.5px] tracking-[0.14em] text-muted uppercase">
          Parler à Alex de ce message
        </span>
      </div>

      <ul className="mt-2 grid gap-2">
        {chat.items.map((item, index) => {
          if (item.kind === "user") {
            // On n'affiche que la demande : le brouillon voyage dans le message
            // pour qu'Alex l'ait sous les yeux, il n'a pas à être relu ici.
            const asked = item.text.split("[Demande]")[1]?.trim() ?? item.text;
            return (
              <li key={index} className="rounded-control bg-brand-l px-2.5 py-1.5 text-[12.5px] text-brand-d">
                {asked}
              </li>
            );
          }

          const parsed = parseReply(item.text);
          const shown = parsed.message === "" && parsed.draft !== null ? "Brouillon repris." : parsed.message;
          return (
            <li key={index} className="px-0.5 text-[12.5px] whitespace-pre-wrap text-ink">
              {shown === "" ? <span className="text-muted">…</span> : shown}
              {parsed.draft !== null && (
                <span className="mt-1 block text-[11.5px] font-semibold text-win-d">
                  ✓ brouillon mis à jour ci-dessus
                </span>
              )}
              {item.chips.length > 0 && (
                <span className="mt-1 block text-[11px] text-muted">
                  {item.chips.map((chip) => chip.label).join(" · ")}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {chat.error !== null && (
        <p className="mt-2 text-[12px] text-[#B2311F]">{chat.error}</p>
      )}

      <div className="mt-2 flex gap-2">
        <input
          value={text}
          disabled={chat.streaming}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          placeholder={`fais plus court · qu'est-ce qu'on sait de ${contactName.split(" ")[0] ?? "elle"} ?`}
          className="min-w-0 flex-1 rounded-control border border-line bg-surface px-2.5 py-2 text-[13px] focus:border-brand focus:outline-none disabled:opacity-60"
        />
        <button
          type="button"
          onClick={send}
          disabled={chat.streaming || text.trim() === ""}
          className="rounded-control bg-brand px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-d disabled:opacity-50"
        >
          {chat.streaming ? "…" : "Envoyer"}
        </button>
      </div>

      <p className="mt-1.5 text-[11.5px] text-muted">
        Alex repart toujours du texte affiché ci-dessus — vos retouches à la main ne sont jamais
        écrasées. Une question sur {contactName.split(" ")[0] ?? "le contact"} ne modifie pas le
        brouillon.
      </p>
    </div>
  );
}
