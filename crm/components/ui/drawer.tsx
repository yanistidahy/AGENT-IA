"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./icon";

/**
 * Tiroir latéral, reprenant l'animation du prototype.
 *
 * Ferme sur Échap et sur clic hors panneau ; le focus part sur le bouton de
 * fermeture à l'ouverture et le défilement de la page est bloqué tant que le
 * tiroir est ouvert.
 */
interface DrawerProps {
  readonly open: boolean;
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  readonly onClose: () => void;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
}

export function Drawer({ open, title, subtitle, onClose, footer, children }: DrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-[rgba(12,22,20,0.42)] backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        className="fixed inset-y-0 right-0 z-50 flex w-[min(600px,100vw)] flex-col bg-surface shadow-float"
      >
        <header className="flex flex-none items-start gap-3 border-b border-line px-[22px] py-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[19px] leading-tight font-semibold tracking-tight">
              {title}
            </h2>
            {subtitle !== undefined && (
              <div className="mt-0.5 text-[13px] text-muted">{subtitle}</div>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-control p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-[22px] py-5">{children}</div>

        {footer !== undefined && (
          <footer className="flex flex-none gap-2 border-t border-line bg-surface-2 px-[22px] py-3">
            {footer}
          </footer>
        )}
      </aside>
    </>
  );
}
