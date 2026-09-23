"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestJson } from "@/lib/client/http";

/**
 * « Arrêter » — visible tant que la composition tourne.
 *
 * **Elle n'interrompt pas le brouillon en cours** : il est déjà payé, le tuer
 * ne rendrait pas l'argent et perdrait le texte. Elle pose un drapeau que la
 * boucle relit avant de commencer le suivant, donc l'arrêt prend effet à la
 * fin du brouillon courant, au plus tard. Ce qui est en file y reste.
 */
export function StopComposition({ campaignId }: { readonly campaignId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [asked, setAsked] = useState(false);

  const stop = async () => {
    setBusy(true);
    await requestJson(
      "/api/campaigns/compose",
      { method: "POST", body: JSON.stringify({ campaignId, action: "stop" }) },
      (value): value is { stopping: boolean } =>
        typeof value === "object" && value !== null && "stopping" in value,
    );
    setBusy(false);
    setAsked(true);
    router.refresh();
  };

  if (asked) {
    return (
      <span className="text-[12px] text-muted">
        Arrêt demandé : la composition s'arrête après le brouillon en cours.
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void stop()}
      disabled={busy}
      title="Arrête la composition. Les brouillons déjà écrits restent dans la file ; aucun autre ne sera écrit."
      className="min-h-[44px] rounded-control border border-line bg-surface px-3 text-[12.5px] font-semibold hover:border-danger hover:text-danger disabled:opacity-50 lg:min-h-0 lg:py-1"
    >
      Arrêter
    </button>
  );
}
