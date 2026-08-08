"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJson } from "@/lib/client/activity-api";
import type { SearchKind } from "@/lib/api/search";

/**
 * Palette de recherche, ouverte par Ctrl+K (ou ⌘K).
 *
 * Naviguer se fait au clavier de bout en bout : flèches pour parcourir, Entrée
 * pour ouvrir la fiche, Échap pour fermer. Chaque résultat mène à une URL
 * portant `?fiche=`, donc le tiroir de la fiche s'ouvre directement — c'est le
 * même mécanisme que les alertes du centre de pilotage.
 *
 * La recherche est décalée de 180 ms après la dernière frappe : sans cela, un
 * nom de huit lettres déclenche huit requêtes dont sept sont périmées avant
 * d'arriver.
 */
interface Hit {
  readonly kind: SearchKind;
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly href: string;
}

const KIND_LABELS: Record<SearchKind, string> = {
  contact: "Contact",
  company: "Société",
  deal: "Affaire",
  task: "Tâche",
};

function parseHits(payload: Record<string, unknown>): Hit[] {
  const list = payload.hits;
  if (!Array.isArray(list)) return [];

  const hits: Hit[] = [];
  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;
    const bag: Record<string, unknown> = { ...item };
    const { kind, id, label, detail, href } = bag;
    if (
      typeof id === "string" &&
      typeof label === "string" &&
      typeof detail === "string" &&
      typeof href === "string" &&
      (kind === "contact" || kind === "company" || kind === "deal" || kind === "task")
    ) {
      hits.push({ kind, id, label, detail, href });
    }
  }
  return hits;
}

export function SearchPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<readonly Hit[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else {
      setQuery("");
      setHits([]);
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setHits([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      void fetchJson(`/api/search?q=${encodeURIComponent(query.trim())}`).then((result) => {
        if (cancelled) return;
        setHits(result.ok ? parseHits(result.data) : []);
        setActive(0);
        setLoading(false);
      });
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query]);

  const go = useCallback(
    (hit: Hit | undefined) => {
      if (hit === undefined) return;
      setOpen(false);
      router.push(hit.href);
    },
    [router],
  );

  if (!open) return null;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") setOpen(false);
    else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (hits.length === 0 ? 0 : (current + 1) % hits.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (hits.length === 0 ? 0 : (current - 1 + hits.length) % hits.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(hits[active]);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-[rgba(12,22,20,0.42)] backdrop-blur-[2px]"
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Recherche"
        className="fixed top-[12vh] left-1/2 z-[61] w-[min(620px,92vw)] -translate-x-1/2 overflow-hidden rounded-card border border-line bg-surface shadow-float"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Rechercher un contact, une société, une affaire, une tâche…"
          className="w-full border-b border-line bg-surface px-4 py-3.5 text-[14px] outline-none"
        />

        {query.trim().length < 2 ? (
          <p className="px-4 py-6 text-center text-[12.5px] text-muted">
            Tapez au moins deux caractères. ↑ ↓ pour parcourir, Entrée pour ouvrir, Échap pour
            fermer.
          </p>
        ) : hits.length === 0 ? (
          <p className="px-4 py-6 text-center text-[12.5px] text-muted">
            {loading ? "Recherche…" : `Aucun résultat pour « ${query.trim()} ».`}
          </p>
        ) : (
          <ul className="max-h-[52vh] overflow-y-auto">
            {hits.map((hit, index) => (
              <li key={`${hit.kind}-${hit.id}`}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(hit)}
                  className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] transition-colors ${
                    index === active ? "bg-surface-2" : ""
                  }`}
                >
                  <span className="w-[62px] shrink-0 font-mono text-[9.5px] tracking-[0.1em] text-muted uppercase">
                    {KIND_LABELS[hit.kind]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="font-semibold">{hit.label}</b>
                    {hit.detail !== "" && (
                      <span className="block truncate text-[12px] text-muted">{hit.detail}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
