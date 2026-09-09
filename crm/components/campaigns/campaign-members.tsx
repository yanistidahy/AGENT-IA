"use client";

import Link from "next/link";
import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import { formatDate } from "@/lib/format";
import { MEMBER_STATES, type CampaignMember, type MemberState } from "@/lib/domain/campaign-members";

/**
 * Qui est dans la campagne, et où chacun en est.
 *
 * Les trois questions du matin, dans l'ordre : à qui n'a-t-on **pas encore**
 * écrit, qui reste **silencieux**, qui a **répondu**. Les puces filtrent
 * exactement là-dessus — et l'état est dérivé des envois et des réponses, donc
 * il ne peut pas contredire l'entonnoir affiché au-dessus.
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

const STATE_LABEL: Record<MemberState, string> = {
  pending: "Pas encore écrit",
  waiting: "Silencieux",
  replied: "A répondu",
  stopped: "Arrêtée",
};

export function CampaignMembers({
  members,
  onChanged,
}: {
  readonly members: readonly CampaignMember[];
  readonly onChanged: () => void;
}) {
  const [state, setState] = useState<MemberState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = new Map<MemberState, number>();
  for (const member of members) {
    counts.set(member.state, (counts.get(member.state) ?? 0) + 1);
  }

  const shown = state === null ? members : members.filter((member) => member.state === state);

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
        <button
          type="button"
          onClick={() => setState(null)}
          className={`min-h-[44px] rounded-control border px-2.5 text-[12.5px] lg:min-h-0 lg:py-1 ${
            state === null ? "border-brand bg-brand-l text-brand-d" : "border-line hover:border-brand"
          }`}
        >
          Tous ({members.length})
        </button>
        {MEMBER_STATES.map((entry) => (
          <button
            key={entry.value}
            type="button"
            onClick={() => setState(entry.value)}
            className={`min-h-[44px] rounded-control border px-2.5 text-[12.5px] lg:min-h-0 lg:py-1 ${
              state === entry.value
                ? "border-brand bg-brand-l text-brand-d"
                : "border-line hover:border-brand"
            }`}
          >
            {entry.label} ({counts.get(entry.value) ?? 0})
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-control border border-line-2">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface-2">
              {["Contact", "Société", "Rôle", "Étape", "Dernier message", "État", ""].map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="border-b border-line px-2.5 py-2 text-left font-mono text-[9.5px] tracking-[0.12em] whitespace-nowrap text-muted uppercase"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((member) => (
              <tr key={member.enrollmentId}>
                <td className="border-b border-line-2 px-2.5 py-2 text-[13px]">
                  <Link
                    href={`/contacts?lifecycle=all&fiche=${encodeURIComponent(member.contactId)}`}
                    className="font-medium hover:underline"
                  >
                    {member.name}
                  </Link>
                </td>
                <td className="border-b border-line-2 px-2.5 py-2 text-[12.5px]">{member.company}</td>
                <td className="border-b border-line-2 px-2.5 py-2 text-[12.5px]">
                  {member.role === "" ? <span className="text-muted">—</span> : member.role}
                </td>
                <td className="border-b border-line-2 px-2.5 py-2 font-mono text-[12px] tabular-nums">
                  {member.step === 0 ? "—" : `${member.step}/${member.steps}`}
                </td>
                <td className="border-b border-line-2 px-2.5 py-2 text-[12.5px]">
                  {member.lastSentAt === null ? (
                    <span className="text-muted">jamais</span>
                  ) : (
                    <>
                      {formatDate(member.lastSentAt)}
                      {member.opened && <span className="ml-1 text-win-d" title="Ouvert (estimation)">◔</span>}
                    </>
                  )}
                </td>
                <td className="border-b border-line-2 px-2.5 py-2 text-[12.5px]">
                  <span className={member.state === "replied" ? "font-semibold text-win-d" : ""}>
                    {STATE_LABEL[member.state]}
                  </span>
                  {member.state === "stopped" && member.stopReason !== "" && (
                    <span className="block text-[11.5px] text-muted">{member.stopReason}</span>
                  )}
                </td>
                <td className="border-b border-line-2 px-2.5 py-2 text-right">
                  {member.state !== "stopped" && (
                    <button
                      type="button"
                      onClick={() => void remove(member)}
                      disabled={busy === member.enrollmentId}
                      title="Retire de la campagne. La fiche et son historique restent intacts."
                      className="min-h-[44px] text-[12px] text-muted hover:text-danger disabled:opacity-50 lg:min-h-0"
                    >
                      Retirer
                    </button>
                  )}
                </td>
              </tr>
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
