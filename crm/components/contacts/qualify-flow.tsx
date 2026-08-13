"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { UndoToast, type ToastState } from "@/components/ui/undo-toast";
import { undoQueueBatch } from "@/lib/client/queue-api";
import { qualifyContact } from "@/lib/client/qualify-api";
import { QualifyDialog } from "./qualify-dialog";

/**
 * Le geste complet : la modale, l'écriture, le filet.
 *
 * Regroupé ici parce que les trois sont indissociables — une modale qui écrit
 * sans annulation, ou une annulation offerte pour une écriture qui n'a pas eu
 * lieu, seraient chacune un mensonge d'écran.
 *
 * L'annulation passe par `POST /api/queue` en mode `undo`, exactement comme la
 * file d'accueil : les étapes inverses viennent du serveur et ne sont jamais
 * fabriquées ici. Dix secondes plutôt que cinq — supprimer une affaire qu'on
 * vient de créer se décide moins vite que défaire un report.
 */
export interface QualifyTarget {
  readonly id: string;
  readonly name: string;
}

export function QualifyFlow({
  target,
  offers,
  defaultOffer,
  onClose,
  onChanged,
}: {
  target: QualifyTarget | null;
  offers: readonly string[];
  defaultOffer: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const run = async (amount: number, offer: string) => {
    if (target === null) return;
    setBusy(true);
    setError(null);

    const result = await qualifyContact({ contactId: target.id, amount, offer });
    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    onClose();
    const { dealId, dealName, created, message, undo } = result.data;

    setToast({
      message,
      tone: "ok",
      // Rien à annuler quand rien n'a été créé et que le cycle de vie n'a pas
      // bougé : un bouton « Annuler » qui ne défait rien use la confiance
      // qu'on met dans les autres.
      onUndo:
        undo.length === 0
          ? undefined
          : async () => {
              const back = await undoQueueBatch(undo, []);
              if (!back.ok) setToast({ message: back.message, tone: "error" });
              onChanged();
              router.refresh();
            },
      detail: (
        <Link
          href={`/affaires?status=all&fiche=${encodeURIComponent(dealId)}`}
          className="underline hover:text-brand-d"
        >
          {created ? "Ouvrir l'affaire" : `Ouvrir « ${dealName} »`}
        </Link>
      ),
    });

    onChanged();
    router.refresh();
  };

  return (
    <>
      {target !== null && (
        <QualifyDialog
          contactName={target.name}
          offers={offers}
          defaultOffer={defaultOffer}
          busy={busy}
          error={error}
          onCancel={() => {
            setError(null);
            onClose();
          }}
          onConfirm={(amount, offer) => void run(amount, offer)}
        />
      )}

      <UndoToast state={toast} onDismiss={() => setToast(null)} millis={10_000} />
    </>
  );
}
