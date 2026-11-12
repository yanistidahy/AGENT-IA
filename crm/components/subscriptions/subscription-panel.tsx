"use client";

import { useCallback, useEffect, useState } from "react";
import { requestJson } from "@/lib/client/http";
import {
  DEFAULT_AMOUNT_CENTS,
  SUBSCRIPTION_STATUS_LABELS,
  formatAmount,
  isSubscriptionStatus,
  parseEuroInput,
  type SubscriptionView,
} from "@/lib/domain/subscriptions";
import { formatDate } from "@/lib/format";

/**
 * L'abonnement mensuel d'une société, dans sa fiche.
 *
 * Le geste : à la fin de l'essai, on génère **un lien** et on l'envoie. Le
 * client le paie lui-même chez Mollie ; le CRM n'a ni numéro de carte ni mot de
 * passe à manipuler, seulement ce lien et l'état qui revient par le webhook.
 */

function text(bag: Record<string, unknown>, key: string): string | null {
  const value = bag[key];
  return typeof value === "string" ? value : null;
}

function readView(value: unknown): SubscriptionView | null {
  if (typeof value !== "object" || value === null) return null;
  const bag: Record<string, unknown> = { ...value };
  const id = text(bag, "id");
  const companyId = text(bag, "companyId");
  const companyName = text(bag, "companyName");
  const status = text(bag, "status");
  const label = text(bag, "label");
  const createdAt = text(bag, "createdAt");
  const lastPaymentStatus = text(bag, "lastPaymentStatus");
  const amountCents = bag["amountCents"];
  if (
    id === null || companyId === null || companyName === null || status === null ||
    label === null || createdAt === null || lastPaymentStatus === null ||
    typeof amountCents !== "number" || !isSubscriptionStatus(status)
  ) {
    return null;
  }
  return {
    id, companyId, companyName, status, amountCents, label, createdAt, lastPaymentStatus,
    activatedAt: text(bag, "activatedAt"),
    startDate: text(bag, "startDate"),
    lastPaymentAt: text(bag, "lastPaymentAt"),
    link: text(bag, "link"),
  };
}

function readViews(value: unknown): SubscriptionView[] | null {
  if (!Array.isArray(value)) return null;
  const views: SubscriptionView[] = [];
  for (const entry of value) {
    const view = readView(entry);
    if (view === null) return null;
    views.push(view);
  }
  return views;
}

function isList(value: unknown): value is { subscriptions: unknown[] } {
  return (
    typeof value === "object" && value !== null && "subscriptions" in value &&
    readViews(value.subscriptions) !== null
  );
}

function isCreated(value: unknown): value is { subscription: unknown } {
  return (
    typeof value === "object" && value !== null && "subscription" in value &&
    readView(value.subscription) !== null
  );
}

const STATUS_STYLE: Record<SubscriptionView["status"], string> = {
  pending: "bg-gold-l text-gold-d",
  active: "bg-win-l text-win-d",
  past_due: "bg-pulse-l text-[#B2311F]",
  canceled: "bg-line-2 text-muted",
};

export function SubscriptionPanel({ companyId }: { readonly companyId: string }) {
  const [items, setItems] = useState<SubscriptionView[] | null>(null);
  const [amountText, setAmountText] = useState(String(DEFAULT_AMOUNT_CENTS / 100));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await requestJson(
      `/api/subscriptions?companyId=${encodeURIComponent(companyId)}`,
      { cache: "no-store" },
      isList,
    );
    if (!result.ok) {
      setError(result.message);
      setItems([]);
      return;
    }
    setItems(readViews(result.data.subscriptions) ?? []);
  }, [companyId]);

  useEffect(() => {
    setItems(null);
    setError(null);
    void load();
  }, [load]);

  async function generate() {
    const amountCents = parseEuroInput(amountText);
    if (amountCents === null) {
      setError("Montant illisible : tapez par exemple 80 ou 79,90 (entre 1 € et 5 000 €).");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await requestJson(
      "/api/subscriptions",
      { method: "POST", body: JSON.stringify({ companyId, amountCents }) },
      isCreated,
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    await load();
  }

  async function copy(link: string, id: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(id);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Copie impossible : sélectionnez le lien et copiez-le à la main.");
    }
  }

  const hasLive = (items ?? []).some((i) => i.status === "active" || i.status === "past_due");

  return (
    <section className="mt-5 border-t border-line-2 pt-4" aria-labelledby="sub-title">
      <h3 id="sub-title" className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
        Abonnement mensuel
      </h3>

      {items === null && <p className="mt-2 text-[12.5px] text-muted">Chargement…</p>}

      {items !== null && items.length === 0 && (
        <p className="mt-2 text-[12.5px] text-muted">
          Aucun lien pour l&apos;instant. Générez-le à la fin de l&apos;essai gratuit.
        </p>
      )}

      {items !== null && items.length > 0 && (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-control border border-line px-3 py-2 text-[12.5px]">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-[2px] text-[11px] font-semibold ${STATUS_STYLE[item.status]}`}
                >
                  {SUBSCRIPTION_STATUS_LABELS[item.status]}
                </span>
                <span className="font-mono font-semibold tabular-nums">
                  {formatAmount(item.amountCents)} / mois
                </span>
                <span className="ml-auto text-muted">{formatDate(new Date(item.createdAt))}</span>
              </div>
              {item.status === "active" && item.startDate !== null && (
                <p className="mt-1 text-muted">Prochain prélèvement le {item.startDate}.</p>
              )}
              {item.status === "past_due" && (
                <p className="mt-1 text-[#B2311F]">Le dernier prélèvement a échoué.</p>
              )}
              {item.link !== null && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    readOnly
                    value={item.link}
                    aria-label="Lien de paiement"
                    onFocus={(event) => event.currentTarget.select()}
                    className="min-w-0 flex-1 rounded-control border border-line bg-board px-2 py-1 font-mono text-[11.5px]"
                  />
                  <button
                    type="button"
                    onClick={() => void copy(item.link ?? "", item.id)}
                    className="rounded-control bg-brand px-3 py-1 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-d"
                  >
                    {copied === item.id ? "Copié" : "Copier"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {items !== null && !hasLive && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-[12px] text-muted">
            Montant mensuel (€)
            <input
              value={amountText}
              onChange={(event) => setAmountText(event.target.value)}
              inputMode="decimal"
              className="mt-1 block w-28 rounded-control border border-line px-2 py-1 text-[13px] text-ink"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void generate()}
            className="rounded-control border border-brand px-3 py-1.5 text-[12.5px] font-semibold text-brand transition-colors hover:bg-brand-l disabled:opacity-50"
          >
            {busy ? "Génération…" : "Générer un lien de paiement"}
          </button>
        </div>
      )}

      {error !== null && (
        <p role="alert" className="mt-2 rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
          {error}
        </p>
      )}
    </section>
  );
}
