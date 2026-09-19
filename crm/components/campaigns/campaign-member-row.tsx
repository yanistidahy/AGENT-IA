"use client";

import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { CampaignMember, MemberState } from "@/lib/domain/campaign-members";

/**
 * Une ligne du tableau des inscrits.
 *
 * Extraite pour que `campaign-members.tsx` tienne sous la limite de 250 lignes
 * une fois le tri et les puces ajoutés — et parce qu'une ligne est la seule
 * chose de cet écran qui se regarde vraiment.
 */

const STATE_LABEL: Record<MemberState, string> = {
  pending: "Pas encore écrit",
  waiting: "Silencieux",
  replied: "A répondu",
  stopped: "Arrêtée",
};

const CELL = "border-b border-line-2 px-2.5 py-2";

export function CampaignMemberRow({
  member,
  busy,
  onRemove,
}: {
  readonly member: CampaignMember;
  readonly busy: boolean;
  readonly onRemove: () => void;
}) {
  return (
    <tr className={member.handRemoved ? "bg-surface-2 text-muted" : ""}>
      <td className={`${CELL} text-[13px]`}>
        <Link
          href={`/contacts?lifecycle=all&fiche=${encodeURIComponent(member.contactId)}`}
          className="font-medium hover:underline"
        >
          {member.name}
        </Link>
      </td>
      <td className={`${CELL} text-[12.5px]`}>{member.company}</td>
      <td className={`${CELL} text-[12.5px]`}>
        {member.role === "" ? <span className="text-muted">—</span> : member.role}
      </td>
      <td className={`${CELL} font-mono text-[12px] tabular-nums`}>
        {member.step === 0 ? "—" : `${member.step}/${member.steps}`}
      </td>
      <td className={`${CELL} text-[12.5px]`}>
        {member.lastSentAt === null ? (
          // « jamais » plutôt qu'un tiret : un tiret se lit comme une donnée
          // manquante, alors que c'est un fait — rien ne lui a été écrit.
          <span className="text-muted">jamais</span>
        ) : (
          formatDate(member.lastSentAt)
        )}
      </td>
      {/*
        L'ouverture a sa colonne : le nombre « 13 sur 52 » du haut de page ne
        vaut que si l'on peut le recompter ligne à ligne, comme les réponses.
        Estimation, toujours — l'image se charge sans qu'on ait lu.
      */}
      <td className={`${CELL} text-[12.5px]`}>
        {member.openedAt === null ? (
          <span className="text-muted">{member.written ? "—" : ""}</span>
        ) : (
          <span className="text-win-d" title="Ouverture estimée : l'image a été chargée">
            ◔ {formatDate(member.openedAt)}
          </span>
        )}
      </td>
      <td className={`${CELL} text-[12.5px]`}>
        {member.repliedAt === null ? (
          <span className="text-muted">{member.written ? "—" : ""}</span>
        ) : (
          <span className="font-medium text-win-d">{formatDate(member.repliedAt)}</span>
        )}
      </td>
      <td className={`${CELL} text-[12.5px]`}>
        <span className={member.state === "replied" ? "font-semibold text-win-d" : ""}>
          {STATE_LABEL[member.state]}
        </span>
        {member.state === "stopped" && member.stopReason !== "" && (
          <span className="block text-[11.5px] text-muted">{member.stopReason}</span>
        )}
      </td>
      <td className={`${CELL} text-right`}>
        {member.state !== "stopped" && (
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            title="Retire de la campagne. La fiche et son historique restent intacts."
            className="min-h-[44px] text-[12px] text-muted hover:text-danger disabled:opacity-50 lg:min-h-0"
          >
            Retirer
          </button>
        )}
      </td>
    </tr>
  );
}
