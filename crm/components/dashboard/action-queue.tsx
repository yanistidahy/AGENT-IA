"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ActionGroup, ActionRow } from "@/lib/api/dashboard";
import { requestJson } from "@/lib/client/http";
import { updateTask } from "@/lib/client/activity-api";
import { formatDate } from "@/lib/format";
import { Drawer } from "@/components/ui/drawer";
import { LogForm } from "@/components/activities/log-form";

/**
 * File d'action de l'accueil.
 *
 * Trois raisons d'exister, toutes tirées d'un usage réel :
 *
 * 1. **Chaque ligne dit ce qui lui est propre** — nom, société, téléphone,
 *    silence, dernier mot échangé. Dix lignes portant la même phrase ne
 *    permettent pas de choisir laquelle traiter d'abord ;
 * 2. **on agit sans quitter la page** — consigner un appel, reporter, marquer
 *    fait. Le détour par la fiche est ce qui fait qu'on ne le fait pas ;
 * 3. **les groupes portent leur nom**, et un groupe vide disparaît au lieu
 *    d'afficher une invitation à ne rien faire.
 */
const GROUP_LABELS: Record<ActionGroup, string> = {
  reminders: "Relances dues",
  tasks: "Tâches en retard",
  deals: "Affaires bloquées",
};

const ACTION =
  "rounded-control border border-line bg-surface px-2 py-1 text-[11.5px] font-semibold transition-colors hover:bg-surface-2 disabled:opacity-50";

export function ActionQueue({
  rows,
  owners,
  defaultOwner,
}: {
  rows: readonly ActionRow[];
  owners: readonly string[];
  defaultOwner: string;
}) {
  const router = useRouter();
  const [logging, setLogging] = useState<ActionRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-line px-3.5 py-4 text-[12.5px] text-muted">
        Rien à traiter : aucune relance due, aucune tâche en retard, aucune affaire en sommeil.
      </p>
    );
  }

  const postpone = async (row: ActionRow) => {
    setBusy(row.id);
    const due = new Date();
    due.setDate(due.getDate() + 3);
    const iso = due.toISOString().slice(0, 10);

    const result =
      row.taskId !== null
        ? await updateTask(row.taskId, { due: iso })
        : await requestJson(
            `/api/contacts/${row.contactId}`,
            { method: "PATCH", body: JSON.stringify({ nextReminder: iso }) },
            (value): value is unknown => value !== undefined,
          );

    setBusy(null);
    if (result.ok) {
      setNotice(`« ${row.title} » reporté au ${formatDate(due)}.`);
      router.refresh();
    }
  };

  const complete = async (row: ActionRow) => {
    if (row.taskId === null) return;
    setBusy(row.id);
    const result = await updateTask(row.taskId, { done: true });
    setBusy(null);
    if (result.ok) {
      setNotice(`« ${row.title} » marqué fait.`);
      router.refresh();
    }
  };

  const groups: ActionGroup[] = ["reminders", "tasks", "deals"];

  return (
    <>
      {notice !== null && (
        <p className="mb-2 rounded-control border border-[#B9E7DC] bg-flux-l px-3 py-2 text-[12.5px] text-flux-d">
          {notice}
        </p>
      )}

      {groups.map((group) => {
        const inGroup = rows.filter((row) => row.group === group);
        if (inGroup.length === 0) return null;

        return (
          <section key={group} className="mb-3">
            <h3 className="mb-1.5 font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
              {GROUP_LABELS[group]} ({inGroup.length})
            </h3>
            <ul className="grid gap-1.5">
              {inGroup.map((row) => (
                <li
                  key={row.id}
                  className="rounded-card border border-line bg-surface px-3.5 py-2.5"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <b className="text-[13px] font-semibold">{row.title}</b>
                    {row.company !== null && (
                      <span className="text-[12.5px] text-muted">{row.company}</span>
                    )}
                    {row.phone !== "" && (
                      // Cliquable : sur mobile c'est un appel, sur poste fixe
                      // c'est au moins un numéro qu'on n'a pas à retaper.
                      <a
                        href={`tel:${row.phone.replace(/\s/g, "")}`}
                        className="font-mono text-[12px] text-flux-d hover:underline"
                      >
                        {row.phone}
                      </a>
                    )}
                    {row.idleDays !== null && (
                      <span className="text-[12px] text-muted">
                        {row.idleDays} j sans contact
                      </span>
                    )}
                    {row.due !== null && (
                      <span className="text-[12px] text-[#B2311F]">
                        échéance {formatDate(row.due)}
                      </span>
                    )}
                  </div>

                  {row.lastNote !== "" && (
                    <p className="mt-0.5 text-[12px] text-muted italic">« {row.lastNote} »</p>
                  )}

                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {row.contactId !== null && (
                      <button
                        type="button"
                        className={ACTION}
                        onClick={() => setLogging(row)}
                      >
                        Consigner un appel
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy === row.id || (row.taskId === null && row.contactId === null)}
                      className={ACTION}
                      onClick={() => void postpone(row)}
                    >
                      Reporter à +3 j
                    </button>
                    {row.taskId !== null && (
                      <button
                        type="button"
                        disabled={busy === row.id}
                        className={ACTION}
                        onClick={() => void complete(row)}
                      >
                        Marquer fait
                      </button>
                    )}
                    <Link href={hrefFor(row)} className={ACTION}>
                      Ouvrir la fiche
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <Drawer
        open={logging !== null}
        title={logging === null ? "" : `Consigner — ${logging.title}`}
        onClose={() => setLogging(null)}
      >
        {logging !== null && logging.contactId !== null && (
          <LogForm
            link={{ contactId: logging.contactId }}
            owners={owners}
            defaultOwner={defaultOwner}
            onCancel={() => setLogging(null)}
            onLogged={(summary) => {
              setLogging(null);
              setNotice(summary);
              router.refresh();
            }}
          />
        )}
      </Drawer>
    </>
  );
}

function hrefFor(row: ActionRow): string {
  if (row.contactId !== null) {
    return `/contacts?lifecycle=all&fiche=${encodeURIComponent(row.contactId)}`;
  }
  if (row.dealId !== null) return `/affaires?status=all&fiche=${encodeURIComponent(row.dealId)}`;
  return "/taches";
}
