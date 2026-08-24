"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./icon";

/**
 * Tiroir latéral, reprenant l'animation du prototype.
 *
 * Ferme sur Échap, sur clic hors panneau et sur le bouton ✕. Le focus part sur
 * le bouton de fermeture à l'ouverture, **revient à l'élément d'où l'on vient**
 * à la fermeture, et le défilement de la page est bloqué tant que le tiroir est
 * ouvert.
 *
 * Trois choses valent d'être dites sur la mécanique, parce qu'elles ont été
 * écrites de travers avant :
 *
 * 1. **`onClose` est lu dans une référence, pas dans les dépendances.** Il vient
 *    presque toujours d'une flèche définie dans le rendu du parent, donc d'une
 *    identité neuve à chaque rendu : le mettre en dépendance faisait rejouer
 *    l'effet à *chaque* rendu, et donc reprendre le focus sur le ✕ pendant qu'on
 *    travaillait dans le tiroir.
 * 2. **Le panneau passe au-dessus du voile par son `z-index`, pas par l'ordre du
 *    DOM.** Les deux étaient à `z-50` et seul l'ordre des nœuds les départageait
 *    — un portail, une transition ou un fragment inséré entre eux aurait suffi à
 *    faire passer le voile devant le ✕, ce qui rend le bouton inerte sans que
 *    rien ne paraisse anormal.
 * 3. **Le voile ne ferme que si le geste a commencé sur lui.** Un `mousedown`
 *    dans le panneau qui finit sur le voile — une sélection de texte qu'on tire
 *    trop loin, un glissement de curseur — ne doit pas refermer le tiroir.
 */
interface DrawerProps {
  readonly open: boolean;
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  readonly onClose: () => void;
  readonly footer?: ReactNode;
  /**
   * Bandeau fixe sous l'en-tête : ce qui doit rester visible quel que soit le
   * défilement — l'état de la fiche, le numéro, l'action primaire, les onglets.
   * Hors du corps défilant, sinon « sans défiler » n'est vrai qu'au chargement.
   */
  readonly banner?: ReactNode;
  readonly children: ReactNode;
}

export function Drawer({
  open,
  title,
  subtitle,
  onClose,
  footer,
  banner,
  children,
}: DrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  /** L'élément qui avait le focus avant l'ouverture — la ligne du tableau. */
  const opener = useRef<HTMLElement | null>(null);
  const overlayDown = useRef(false);

  // `onClose` change d'identité à chaque rendu du parent ; le garder dans une
  // référence permet à l'effet ci-dessous de ne dépendre que de `open`.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;

    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
    };
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      // Rendre le focus là où on l'a pris : sans cela, il retombe sur `body` et
      // la tabulation suivante repart du haut de la page.
      opener.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-[rgba(13,18,32,0.42)] backdrop-blur-[2px]"
        onMouseDown={(event) => {
          overlayDown.current = event.target === event.currentTarget;
        }}
        onClick={(event) => {
          if (overlayDown.current && event.target === event.currentTarget) close.current();
          overlayDown.current = false;
        }}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        // `h-dvh` et non `inset-y-0` : le clavier virtuel réduit le viewport
        // *dynamique* — avec une hauteur figée, le pied du tiroir (le bouton
        // « Envoyer » du panneau de rédaction) resterait caché sous le clavier.
        className="fixed top-0 right-0 z-50 flex h-dvh w-[min(600px,100vw)] flex-col bg-surface shadow-float"
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
            onClick={() => close.current()}
            aria-label="Fermer"
            className="relative z-10 shrink-0 rounded-control p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink max-lg:flex max-lg:size-11 max-lg:items-center max-lg:justify-center max-lg:p-0"
          >
            <Icon name="x" size={18} />
          </button>
        </header>

        {banner !== undefined && <div className="flex-none">{banner}</div>}

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
