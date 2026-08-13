"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";

interface ComposerProps {
  readonly agentName: string;
  readonly disabled: boolean;
  readonly streaming: boolean;
  readonly deep: boolean;
  readonly onDeepChange: (deep: boolean) => void;
  readonly onSend: (text: string) => void;
}

/**
 * Barre de saisie.
 *
 * Un seul envoi en vol : pendant le streaming, l'envoi est refusé côté client
 * avec un message, et le serveur applique la même règle de son côté.
 */
export function Composer({
  agentName,
  disabled,
  streaming,
  deep,
  onDeepChange,
  onSend,
}: ComposerProps) {
  const [text, setText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const submit = () => {
    const value = text.trim();
    if (value === "") return;
    if (streaming) {
      setNotice("Attendez la fin de la réponse en cours avant d'envoyer un nouveau message.");
      return;
    }
    setNotice(null);
    setText("");
    onSend(value);
  };

  return (
    <div className="flex-none border-t border-[#1E2430] px-5 py-3">
      {notice !== null && (
        <p className="mb-2 text-[12px] text-gold">{notice}</p>
      )}

      <div className="flex items-end gap-2 rounded-card border border-[#242C3A] bg-[#141821] px-3 py-2 focus-within:border-violet">
        <textarea
          value={text}
          disabled={disabled}
          rows={1}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={
            disabled
              ? "Cet agent n'est pas disponible."
              : `Envoyez un message à ${agentName}…`
          }
          className="max-h-40 min-h-6 flex-1 resize-none bg-transparent text-[13.5px] text-white outline-none placeholder:text-[#5F6B7C] disabled:cursor-not-allowed"
        />

        <button
          type="button"
          onClick={submit}
          disabled={disabled || text.trim() === ""}
          aria-label="Envoyer"
          className="rounded-control bg-brand p-1.5 text-white transition-colors hover:bg-brand-d disabled:bg-[#2A3240] disabled:text-[#5F6B7C]"
        >
          <Icon name="arrow" size={15} />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={deep}
          onClick={() => onDeepChange(!deep)}
          className="flex items-center gap-2 text-[12px] text-[#8B97A8] transition-colors hover:text-white"
        >
          <span
            aria-hidden
            className={`relative h-4 w-8 rounded-full transition-colors ${
              deep ? "bg-violet" : "bg-[#2A3240]"
            }`}
          >
            <span
              className={`absolute top-0.5 size-3 rounded-full bg-white transition-transform ${
                deep ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </span>
          Mode approfondi
        </button>

        <span className="text-[11px] text-[#4E5867]">
          {deep
            ? "Raisonnement étendu, cheminement affiché. Plus lent."
            : "Réponse directe."}
        </span>

        {streaming && (
          <span className="ml-auto flex items-center gap-1.5 text-[11.5px] text-violet">
            <i aria-hidden className="size-1.5 animate-pulse rounded-full bg-violet" />
            en cours…
          </span>
        )}
      </div>
    </div>
  );
}
