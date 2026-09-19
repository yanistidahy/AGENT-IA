"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import type { ContactListSummary } from "@/lib/api/contact-lists";

/**
 * La grille des listes : un nom, un compte, et rien d'autre.
 *
 * **Ce que la vignette ne porte pas est délibéré.** Ni les fiches, ni un
 * aperçu : cette page sert à choisir, et six vignettes doivent tenir dans un
 * écran (jalon 71). Le contenu se travaille sur la page de la liste.
 *
 * Le compte est lu en base à chaque rendu, jamais stocké sur la liste : une
 * colonne à tenir à jour finirait par annoncer douze fiches au-dessus de huit,
 * et c'est le genre d'écart qu'on ne remarque qu'après avoir écrit à huit
 * personnes en croyant en toucher douze (jalons 6, 49 et 71).
 */
export function ListsView({ lists }: { readonly lists: readonly ContactListSummary[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    const result = await requestJson(
      "/api/lists",
      { method: "POST", body: JSON.stringify({ name }) },
      (value): value is { id: string } =>
        typeof value === "object" && value !== null && "id" in value,
    );
    setBusy(false);
    if (result.ok) {
      setName("");
      router.push(`/listes/${result.data.id}`);
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="px-6 py-6">
      <header className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Listes</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {lists.length} liste{lists.length > 1 ? "s" : ""} · constituées à la main, elles ne
            changent que lorsque vous les changez.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nom de la liste…"
            className="min-h-[44px] rounded-control border border-line bg-surface px-2.5 text-[13px] lg:min-h-0 lg:py-2"
          />
          <button
            type="button"
            disabled={busy || name.trim() === ""}
            onClick={() => void create()}
            className="min-h-[44px] rounded-control bg-brand px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-d disabled:opacity-50 lg:min-h-0 lg:py-2"
          >
            Nouvelle liste
          </button>
        </div>
      </header>

      {error !== null && (
        <p className="mb-3 rounded-control border border-danger px-3 py-2 text-[12.5px] text-danger">
          {error}
        </p>
      )}

      {lists.length === 0 ? (
        <p className="rounded-card border border-line bg-surface px-4 py-6 text-[13px] text-muted">
          Aucune liste pour l&apos;instant. Créez-en une ici, ou depuis /contacts : cochez des
          fiches, puis « Ajouter à une liste ».
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {lists.map((list) => (
            <Link
              key={list.id}
              href={`/listes/${list.id}`}
              className="rounded-card border border-line bg-surface px-4 py-3 transition-colors hover:border-brand"
            >
              <p className="font-display text-[15px] font-semibold tracking-tight">{list.name}</p>
              <p className="mt-1 text-[12.5px] text-muted">
                {list.members} fiche{list.members > 1 ? "s" : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
