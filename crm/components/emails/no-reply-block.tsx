"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { SilentRow } from "@/lib/api/email-list";
import { Drawer } from "@/components/ui/drawer";
import { LogForm } from "@/components/activities/log-form";
import { ComposePanel } from "@/components/emails/compose-panel";
import { UndoToast, type ToastState } from "@/components/ui/undo-toast";
import { runQueueBatch, undoQueueBatch } from "@/lib/client/queue-api";
import { NoReplyRow } from "./no-reply-row";

/**
 * « Sans réponse depuis X jours » — la file de travail de cet écran.
 *
 * **C'est ce qui fait passer la page du rapport à l'outil.** Un tableau qui
 * nomme les gens sans permettre d'agir oblige à ouvrir un autre écran, à
 * retrouver la fiche, et à refaire le tri de tête à chaque fois. Les trois
 * actions sont donc les mêmes que celles de la file d'accueil — consigner un
 * appel, écrire, marquer perdu — et empruntent le même chemin d'écriture.
 *
 * Deux emprunts délibérés à la file d'accueil, et un écart :
 *
 * - **l'optimisme est local et réversible** : la ligne disparaît tout de suite,
 *   et un refus du serveur la remet exactement où elle était, avec la raison ;
 * - **l'inverse de l'écriture vient du serveur**, jamais reconstruit ici ;
 * - **`mark: false`** : ces lignes ne sont pas la file du jour. Les compter
 *   dans l'anneau de l'accueil y ferait apparaître du travail qui n'y a jamais
 *   été inscrit, et son dénominateur ne redescend jamais.
 */
export function NoReplyBlock({
  rows,
  owners,
  defaultOwner,
}: {
  readonly rows: readonly SilentRow[];
  readonly owners: readonly string[];
  readonly defaultOwner: string;
}) {
  const router = useRouter();
  const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set());
  const [toast, setToast] = useState<ToastState | null>(null);
  const [logging, setLogging] = useState<SilentRow | null>(null);
  const [writing, setWriting] = useState<SilentRow | null>(null);

  const visible = rows.filter((row) => !removed.has(row.contactId));

  const restore = useCallback((contactId: string) => {
    setRemoved((current) => {
      const next = new Set(current);
      next.delete(contactId);
      return next;
    });
  }, []);

  const markLost = useCallback(
    async (row: SilentRow) => {
      const id = `reminder-${row.contactId}`;
      setRemoved((current) => new Set([...current, row.contactId]));

      const result = await runQueueBatch({
        ids: [id],
        action: "lost",
        // Le motif est exact par construction du bloc : ces fiches ont reçu au
        // moins un message et n'ont jamais répondu. Il est écrit dans le
        // libellé du bouton pour que rien ne soit décidé en coulisses.
        reason: "Ne répond plus",
        mark: false,
      });

      if (!result.ok) {
        restore(row.contactId);
        setToast({ message: result.message, tone: "error" });
        return;
      }

      const refused = result.data.failed[0];
      if (refused !== undefined) {
        restore(row.contactId);
        setToast({ message: refused.reason, tone: "error" });
        return;
      }

      setToast({
        message: `${row.name} marqué perdu — ne répond plus.`,
        tone: "ok",
        onUndo: async () => {
          const back = await undoQueueBatch(result.data.undo, []);
          restore(row.contactId);
          if (!back.ok) setToast({ message: back.message, tone: "error" });
          router.refresh();
        },
      });
      router.refresh();
    },
    [restore, router],
  );

  return (
    <>
      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <div className="flex items-baseline justify-between gap-2 border-b border-line bg-surface-2 px-3 py-2">
          <h2 className="font-display text-[13px] font-semibold">Sans réponse</h2>
          <span className="font-mono text-[11px] text-muted tabular-nums">
            {visible.length} personne{visible.length > 1 ? "s" : ""}
          </span>
        </div>

        {visible.length === 0 ? (
          <p className="px-3.5 py-8 text-center text-[12.5px] text-muted">
            Personne n'attend. Tous ceux à qui vous avez écrit ont répondu, ou leur fiche
            est close.
          </p>
        ) : (
          <ul className="max-h-[52vh] overflow-auto">
            {visible.map((row) => (
              <NoReplyRow
                key={row.contactId}
                row={row}
                onLog={() => setLogging(row)}
                onWrite={() => setWriting(row)}
                onLost={() => void markLost(row)}
              />
            ))}
          </ul>
        )}
      </div>

      <UndoToast state={toast} onDismiss={() => setToast(null)} />

      <Drawer
        open={logging !== null}
        title={logging === null ? "" : `Consigner — ${logging.name}`}
        onClose={() => setLogging(null)}
      >
        {logging !== null && (
          <LogForm
            link={{ contactId: logging.contactId }}
            owners={owners}
            defaultOwner={defaultOwner}
            onCancel={() => setLogging(null)}
            onLogged={(summary) => {
              const id = logging.contactId;
              setLogging(null);
              // Consigner une interaction ne veut pas dire qu'on a obtenu une
              // réponse — mais la ligne vient d'être traitée, et la laisser
              // ferait retravailler la même personne deux fois dans la séance.
              setRemoved((current) => new Set([...current, id]));
              setToast({ message: summary, tone: "ok" });
              router.refresh();
            }}
          />
        )}
      </Drawer>

      <ComposePanel
        open={writing !== null}
        contactId={writing?.contactId ?? null}
        onClose={() => setWriting(null)}
        onSent={(sent) => {
          setWriting(null);
          setToast({ message: `Email envoyé à ${sent.contactName} (${sent.to}).`, tone: "ok" });
          router.refresh();
        }}
      />
    </>
  );
}
