"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import { describeListDeletion } from "@/lib/domain/contact-lists";

/**
 * Renommer ou supprimer une liste, depuis sa propre page.
 *
 * **La confirmation de suppression dit ce qui reste**, et c'est tout son objet :
 * la première question devant « Supprimer la liste » est « est-ce que ça efface
 * les contacts ? ». La réponse est non, et elle est composée dans le domaine
 * (`describeListDeletion`) pour que l'écran et le reste du produit n'en donnent
 * jamais deux versions.
 *
 * Aucune friction de nom à retaper, contrairement à une campagne qui a envoyé
 * (jalon 61) : là-bas des faits mesurés disparaissaient, ici rien
 * d'irremplaçable ne part. Exiger une cérémonie pour un rangement apprendrait à
 * cliquer sans lire les vraies confirmations.
 */
export function ListActions({
  list,
}: {
  readonly list: { readonly id: string; readonly name: string; readonly members: number };
}) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(list.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rename = async () => {
    setBusy(true);
    setError(null);
    const result = await requestJson(
      "/api/lists",
      { method: "PATCH", body: JSON.stringify({ id: list.id, name }) },
      (value): value is Record<string, unknown> => typeof value === "object" && value !== null,
    );
    setBusy(false);
    if (result.ok) {
      setRenaming(false);
      router.refresh();
    } else {
      setError(result.message);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    const result = await requestJson(
      "/api/lists",
      { method: "DELETE", body: JSON.stringify({ id: list.id }) },
      (value): value is Record<string, unknown> => typeof value === "object" && value !== null,
    );
    setBusy(false);
    if (result.ok) router.push("/listes");
    else setError(result.message);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
      {renaming ? (
        <>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="min-h-[44px] rounded-control border border-line bg-surface px-2.5 lg:min-h-0 lg:py-1"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void rename()}
            className="min-h-[44px] rounded-control bg-brand px-3 font-medium text-white hover:bg-brand-d disabled:opacity-50 lg:min-h-0 lg:py-1"
          >
            Enregistrer
          </button>
          <button
            type="button"
            onClick={() => {
              setRenaming(false);
              setName(list.name);
            }}
            className="min-h-[44px] rounded-control border border-line px-3 lg:min-h-0 lg:py-1"
          >
            Annuler
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setRenaming(true)}
          className="min-h-[44px] rounded-control border border-line bg-surface px-3 lg:min-h-0 lg:py-1"
        >
          Renommer
        </button>
      )}

      {confirming ? (
        <span className="flex flex-wrap items-center gap-2 rounded-control border border-danger px-2 py-1">
          <span>{describeListDeletion(list.name, list.members)}</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void remove()}
            className="min-h-[44px] rounded-control bg-danger px-3 font-medium text-white disabled:opacity-50 lg:min-h-0 lg:py-1"
          >
            Supprimer
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="min-h-[44px] rounded-control border border-line px-3 lg:min-h-0 lg:py-1"
          >
            Annuler
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="min-h-[44px] rounded-control border border-line px-3 text-danger lg:min-h-0 lg:py-1"
        >
          Supprimer la liste
        </button>
      )}

      {error !== null && <span className="text-danger">{error}</span>}
    </div>
  );
}
