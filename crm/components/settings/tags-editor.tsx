"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";

/**
 * Gestion des étiquettes de contact.
 *
 * Renommer met à jour toutes les fiches qui la portent ; supprimer efface
 * l'étiquette sans toucher aux fiches. Les deux annoncent le nombre de contacts
 * concernés **avant** d'agir : une opération qui touche quarante fiches ne doit
 * pas partir sur un clic mal placé.
 */
interface TagsEditorProps {
  readonly tags: ReadonlyArray<{ value: string; count: number }>;
  readonly onSaved: () => void;
}

function isTags(value: unknown): value is { tags: unknown } {
  return typeof value === "object" && value !== null && "tags" in value;
}

export function TagsEditor({ tags, onSaved }: TagsEditorProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const send = async (init: RequestInit, done: (count: number) => string) => {
    setBusy(true);
    setError(null);
    const result = await requestJson("/api/tags", init, isTags);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const payload: Record<string, unknown> = { ...result.data };
    const count = payload.renamed ?? payload.cleared;
    setNotice(done(typeof count === "number" ? count : 0));
    setEditing(null);
    onSaved();
  };

  if (tags.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-line px-3.5 py-4 text-[12.5px] text-muted">
        Aucune étiquette utilisée. Elles se créent depuis le formulaire d'un contact, champ
        « Étiquette ».
      </p>
    );
  }

  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card">
      <ul className="grid gap-1.5">
        {tags.map((tag) => (
          <li key={tag.value} className="flex flex-wrap items-center gap-2">
            {editing === tag.value ? (
              <>
                <input
                  autoFocus
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="min-w-[180px] flex-1 rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-flux"
                />
                <button
                  type="button"
                  disabled={busy || draft.trim() === ""}
                  onClick={() =>
                    void send(
                      {
                        method: "PATCH",
                        body: JSON.stringify({ from: tag.value, to: draft.trim() }),
                      },
                      (count) => `« ${tag.value} » renommée en « ${draft.trim()} » sur ${count} fiche(s).`,
                    )
                  }
                  className="rounded-control bg-flux px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50"
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-control border border-line px-3 py-1.5 text-[12.5px]"
                >
                  Annuler
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-[13px]">
                  <b className="font-semibold">{tag.value}</b>{" "}
                  <span className="text-muted">— {tag.count} contact(s)</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(tag.value);
                    setDraft(tag.value);
                    setNotice(null);
                  }}
                  className="rounded-control border border-line px-3 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-surface-2"
                >
                  Renommer
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    // La confirmation annonce le nombre exact : c'est ce chiffre
                    // qui fait la différence entre un nettoyage et une bévue.
                    const ok = window.confirm(
                      `Supprimer l'étiquette « ${tag.value} » ? Elle sera retirée de ${tag.count} fiche(s). Les contacts, eux, sont conservés.`,
                    );
                    if (!ok) return;
                    void send(
                      { method: "DELETE", body: JSON.stringify({ tag: tag.value }) },
                      (count) => `« ${tag.value} » retirée de ${count} fiche(s).`,
                    );
                  }}
                  className="rounded-control border border-line px-3 py-1.5 text-[12.5px] text-muted transition-colors hover:bg-surface-2 disabled:opacity-50"
                >
                  Supprimer
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      {notice !== null && (
        <p className="mt-2 text-[12.5px] text-flux-d">{notice}</p>
      )}
      {error !== null && <p className="mt-2 text-[12.5px] text-[#B2311F]">{error}</p>}
    </section>
  );
}
