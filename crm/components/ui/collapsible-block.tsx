"use client";

import type { ReactNode } from "react";
import { usePersistedFlag } from "@/lib/client/persisted";

/**
 * Un bloc d'accueil qui se replie, et qui s'en souvient.
 *
 * Le pli est une préférence d'affichage : elle appartient au poste, pas à la
 * base. Elle est donc rangée dans le stockage local, et la valeur initiale reste
 * celle du serveur — voir `lib/client/persisted.ts` pour pourquoi lire le
 * stockage au premier rendu produirait une divergence d'hydratation.
 *
 * Le titre est un bouton, pas un `<summary>` : `<details>` aurait imposé son
 * propre état interne à côté de celui qu'on conserve, et les deux se seraient
 * contredits au rechargement.
 */
export function CollapsibleBlock({
  id,
  title,
  count,
  hint,
  defaultOpen = true,
  children,
}: {
  /** Clé de conservation. Stable dans le temps : la changer oublie le pli. */
  id: string;
  title: string;
  count?: number;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = usePersistedFlag(`block.${id}`, defaultOpen);

  return (
    <section className="mb-5">
      <h2 className="mb-2.5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex w-full flex-wrap items-baseline gap-2 text-left font-display text-[15px] font-semibold"
        >
          <span aria-hidden className="text-[10px] text-muted">
            {open ? "▾" : "▸"}
          </span>
          {title}
          {count !== undefined && count > 0 && (
            <span className="rounded-full bg-paper px-2 py-[1px] font-mono text-[11px] font-normal text-muted tabular-nums">
              {count}
            </span>
          )}
          {hint !== undefined && <span className="text-[12px] font-normal text-muted">{hint}</span>}
        </button>
      </h2>
      {open && children}
    </section>
  );
}
