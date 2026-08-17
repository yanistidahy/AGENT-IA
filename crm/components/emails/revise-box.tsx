"use client";

import { useState } from "react";

/**
 * Parler à Alex du brouillon en cours.
 *
 * Ce n'est pas un fil de conversation au sens du conseil : c'est une suite
 * d'instructions sur **un** texte, et le texte lui-même vit dans les champs
 * au-dessus. On garde l'échange visible pour pouvoir itérer — « fais plus
 * court » puis « garde quand même la question sur le SAV » ne se comprend que
 * si l'on voit ce qu'on a déjà demandé.
 *
 * La phrase sur les retouches manuelles est affichée, pas seulement vraie :
 * l'utilisateur doit savoir qu'il peut réécrire un paragraphe puis demander une
 * reprise sans que son travail soit jeté. Sans elle, il n'essaiera pas.
 */
export interface Exchange {
  readonly instruction: string;
  /** Ce qu'Alex a fait, en une ligne — ou l'erreur. */
  readonly outcome: string;
  readonly failed: boolean;
}

export function ReviseBox({
  exchanges,
  busy,
  edited,
  canUndo,
  onSubmit,
  onUndo,
}: {
  readonly exchanges: readonly Exchange[];
  readonly busy: boolean;
  /** Le texte a été retouché à la main depuis la dernière version d'Alex. */
  readonly edited: boolean;
  readonly canUndo: boolean;
  readonly onSubmit: (instruction: string) => void;
  readonly onUndo: () => void;
}) {
  const [text, setText] = useState("");

  const submit = () => {
    const instruction = text.trim();
    if (instruction === "" || busy) return;
    setText("");
    onSubmit(instruction);
  };

  return (
    <div className="mt-4 border-t border-line pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[9.5px] tracking-[0.14em] text-muted uppercase">
          Demander une reprise
        </span>
        {canUndo && (
          <button
            type="button"
            onClick={onUndo}
            disabled={busy}
            className="rounded-control border border-line px-2.5 py-1 text-[11.5px] font-semibold text-muted transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            ← Revenir au brouillon précédent
          </button>
        )}
      </div>

      {exchanges.length > 0 && (
        <ul className="mt-2 grid gap-1.5">
          {exchanges.map((exchange, index) => (
            <li key={`${index}-${exchange.instruction}`} className="text-[12.5px]">
              <p className="rounded-control bg-brand-l px-2.5 py-1.5 text-brand-d">
                {exchange.instruction}
              </p>
              <p
                className={`mt-1 px-2.5 text-[12px] ${
                  exchange.failed ? "text-[#B2311F]" : "text-muted"
                }`}
              >
                {exchange.outcome}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex gap-2">
        <input
          value={text}
          disabled={busy}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="insiste sur le SAV · fais plus court · elle refait son site"
          className="min-w-0 flex-1 rounded-control border border-line bg-surface px-2.5 py-2 text-[13px] focus:border-brand focus:outline-none disabled:opacity-60"
        />
        <button
          type="button"
          onClick={submit}
          disabled={busy || text.trim() === ""}
          className="rounded-control bg-brand px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-d disabled:opacity-50"
        >
          {busy ? "…" : "Reprendre"}
        </button>
      </div>

      <p className="mt-1.5 text-[11.5px] text-muted">
        {edited ? (
          <b className="font-semibold text-ink">
            Vos retouches sont prises en compte : Alex repart du texte ci-dessus, pas de sa
            version d'origine.
          </b>
        ) : (
          "Alex repart toujours du texte affiché ci-dessus — vos retouches à la main ne sont jamais écrasées."
        )}
      </p>
    </div>
  );
}
