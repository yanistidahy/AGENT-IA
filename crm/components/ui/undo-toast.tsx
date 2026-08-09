"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Le filet de sécurité de cinq secondes.
 *
 * Une barre d'actions groupées rend l'erreur bon marché à commettre et chère à
 * réparer : un clic sur « Reporter » avec six lignes cochées déplace six
 * échéances. Le remède n'est pas une boîte de confirmation avant — on apprend à
 * cliquer « Oui » sans lire — mais une annulation après, offerte sans être
 * demandée.
 *
 * L'annulation reste possible **tant que le bandeau est là**, et le bandeau
 * s'efface tout seul. C'est le seul état de l'écran qui a le droit de disparaître
 * sans qu'on l'ait touché, parce qu'il ne cache rien : ce qu'il annonce a déjà
 * eu lieu.
 */
export const UNDO_MS = 5000;

export interface ToastState {
  readonly message: string;
  readonly tone: "ok" | "error";
  /** Absent quand l'action n'est pas réversible — un échec, typiquement. */
  readonly onUndo?: () => void | Promise<void>;
}

export function UndoToast({
  state,
  onDismiss,
}: {
  state: ToastState | null;
  onDismiss: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  useEffect(() => {
    if (state === null) return;
    setBusy(false);
    const timer = window.setTimeout(() => dismiss.current(), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  if (state === null) return null;

  const undo = state.onUndo;

  return (
    <div
      // `status` et non `alert` : l'annonce ne doit pas couper la lecture en
      // cours d'un lecteur d'écran pour une action que l'utilisateur vient
      // lui-même de déclencher.
      role="status"
      aria-live="polite"
      className={`fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-card border px-4 py-2.5 shadow-card motion-safe:animate-[toast-in_140ms_ease-out] ${
        state.tone === "ok"
          ? "border-line bg-surface"
          : "border-[#F0C9C2] bg-pulse-l text-[#B2311F]"
      }`}
    >
      <span className="text-[12.5px]">{state.message}</span>

      {undo !== undefined && (
        <button
          type="button"
          disabled={busy}
          className="rounded-control border border-line bg-surface-2 px-2 py-1 text-[11.5px] font-semibold transition-colors hover:bg-paper disabled:opacity-50"
          onClick={() => {
            setBusy(true);
            void Promise.resolve(undo()).finally(() => dismiss.current());
          }}
        >
          {busy ? "Annulation…" : "Annuler"}
        </button>
      )}

      <button
        type="button"
        aria-label="Fermer"
        className="text-[13px] text-muted hover:text-ink"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
}
