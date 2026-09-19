"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import {
  MEMBER_FILTERS,
  matchesMemberFilter,
  sortMembers,
  type CampaignMember,
  type MemberFilter,
  type MemberSortKey,
} from "@/lib/domain/campaign-members";
import { CampaignMemberRow } from "./campaign-member-row";

/**
 * Qui est dans la campagne, et où chacun en est.
 *
 * Les puces répondent dans l'ordre où l'on se pose les questions, et la
 * première de toutes — **qui a été contacté au moins une fois** — n'en avait
 * aucune : « Pas encore écrit », « Silencieux », « A répondu » et « Arrêtés »
 * découpent les écrits en trois et n'en rendent jamais la somme. Elle est lue
 * dans les envois, la même source que « Personnes écrites » en haut de page,
 * pour que les deux nombres ne puissent pas se contredire.
 *
 * Le tableau se trie **par ses en-têtes**, comme /contacts : l'ordre
 * d'insertion dit dans quel ordre on a coché des cases il y a trois semaines,
 * ce qui n'est une réponse à aucune question.
 *
 * Retirer quelqu'un **arrête son inscription sans toucher à sa fiche** : son
 * historique, ses interactions et ses envois passés restent dans le CRM, et
 * /emails continue de les compter. L'inscription est arrêtée plutôt que
 * supprimée — la supprimer sortirait la personne du dénominateur, et le taux de
 * réponse s'améliorerait à chaque retrait.
 */

function isCampaigns(value: unknown): value is { campaigns: unknown } {
  return typeof value === "object" && value !== null && "campaigns" in value;
}

const COLUMNS: ReadonlyArray<{ label: string; sort: MemberSortKey | null }> = [
  { label: "Contact", sort: "name" },
  { label: "Société", sort: "company" },
  { label: "Rôle", sort: "role" },
  { label: "Étape", sort: "step" },
  { label: "Dernier message", sort: "lastSentAt" },
  { label: "Ouvert", sort: "opened" },
  { label: "Réponse", sort: "reply" },
  { label: "État", sort: "state" },
  { label: "", sort: null },
];

const CHIP = "min-h-[44px] rounded-control border px-2.5 text-[12.5px] lg:min-h-0 lg:py-1";

export function CampaignMembers({
  members,
  onChanged,
}: {
  readonly members: readonly CampaignMember[];
  readonly onChanged: () => void;
}) {
  const [filter, setFilter] = useState<MemberFilter>("all");
  const [sort, setSort] = useState<MemberSortKey>("lastSentAt");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Les compteurs portent sur **tous** les inscrits, jamais sur la liste
  // filtrée : une puce qui compterait son propre résultat afficherait toujours
  // le total de ce qu'elle vient de sélectionner (règle du jalon 6).
  const countOf = (value: MemberFilter) =>
    members.filter((member) => matchesMemberFilter(member, value)).length;

  const shown = sortMembers(
    members.filter((member) => matchesMemberFilter(member, filter)),
    sort,
    dir,
  );
  const removed = members.filter((member) => member.handRemoved).length;

  const onSort = (key: MemberSortKey) => {
    if (key === sort) {
      setDir(dir === "asc" ? "desc" : "asc");
      return;
    }
    setSort(key);
    // Une date se lit du plus récent au plus ancien, un texte de A à Z : le
    // premier clic doit donner l'ordre qu'on attend, pas son inverse.
    setDir(key === "lastSentAt" || key === "opened" || key === "reply" ? "desc" : "asc");
  };

  const remove = async (member: CampaignMember) => {
    setBusy(member.enrollmentId);
    setError(null);
    const result = await requestJson(
      "/api/campaigns/actions",
      {
        method: "POST",
        body: JSON.stringify({ action: "remove-member", enrollmentId: member.enrollmentId }),
      },
      isCampaigns,
    );
    setBusy(null);
    if (result.ok) onChanged();
    else setError(result.message);
  };

  if (members.length === 0) {
    return (
      <p className="mt-3 rounded-control border border-dashed border-line px-3 py-3 text-[12.5px] text-muted">
        Personne n'est encore inscrit. Choisissez des contacts depuis /contacts.
      </p>
    );
  }

  return (
    <div className="mt-3">
      <div className="mb-2 flex flex-wrap gap-1.5">
        {MEMBER_FILTERS.map((entry) => (
          <button
            key={entry.value}
            type="button"
            onClick={() => setFilter(entry.value)}
            title={
              entry.value === "written"
                ? "Au moins une étape réellement partie, quoi qu'il se soit passé ensuite."
                : undefined
            }
            className={`${CHIP} ${
              filter === entry.value
                ? "border-brand bg-brand-l text-brand-d"
                : "border-line hover:border-brand"
            }`}
          >
            {entry.label} ({countOf(entry.value)})
          </button>
        ))}
      </div>

      {removed > 0 && (
        <p className="mb-2 text-[12px] text-muted">
          {removed} retiré{removed > 1 ? "s" : ""} à la main depuis la file des départs —
          rangé{removed > 1 ? "s" : ""} en fin de tableau, sur fond gris : ni écrit
          {removed > 1 ? "s" : ""}, ni en attente.
        </p>
      )}

      <div className="overflow-x-auto rounded-control border border-line-2">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface-2">
              {COLUMNS.map((column) => (
                <th
                  key={column.label}
                  scope="col"
                  className="border-b border-line px-2.5 py-2 text-left font-mono text-[9.5px] tracking-[0.12em] whitespace-nowrap text-muted uppercase"
                >
                  {column.sort === null ? (
                    column.label
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSort(column.sort as MemberSortKey)}
                      className="uppercase transition-colors hover:text-ink"
                    >
                      {column.label}
                      {sort === column.sort && (dir === "desc" ? " ↓" : " ↑")}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((member) => (
              <CampaignMemberRow
                key={member.enrollmentId}
                member={member}
                busy={busy === member.enrollmentId}
                onRemove={() => void remove(member)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {shown.length === 0 && (
        <p className="mt-2 text-[12.5px] text-muted">Aucun inscrit dans cet état.</p>
      )}
      {error !== null && <p className="mt-2 text-[12px] text-danger">{error}</p>}
    </div>
  );
}
