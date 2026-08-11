"use client";

import { useEffect, useState } from "react";
import { AMOUNT_REQUIRED } from "@/lib/domain/qualification";

/**
 * La modale de qualification.
 *
 * Deux champs, pas trois. Qualifier, c'est constater que le prospect veut
 * l'offre ; tout ce qu'on a besoin de savoir à cet instant est **combien** et
 * **quoi**. Le reste de l'affaire — étape, échéance, propriétaire — se déduit de
 * la fiche, et se corrige ensuite dans le tiroir de l'affaire si nécessaire.
 *
 * **Annuler annule la qualification elle-même**, pas seulement la saisie. Un
 * contact passé en `Qualifié` sans affaire serait exactement le demi-état que ce
 * jalon supprime : l'appelant ne reçoit donc rien tant que le formulaire n'est
 * pas validé.
 */
export function QualifyDialog({
  contactName,
  offers,
  defaultOffer,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  contactName: string;
  offers: readonly string[];
  defaultOffer: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (amount: number, offer: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [offer, setOffer] = useState(defaultOffer);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const parsed = Number(amount.replace(",", "."));
  const valid = amount.trim() !== "" && Number.isFinite(parsed) && parsed > 0;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-[rgba(12,22,20,0.42)] backdrop-blur-[2px]" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qualify-title"
        className="fixed top-1/2 left-1/2 z-[60] w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-card border border-line bg-surface p-5 shadow-float"
      >
        <h2 id="qualify-title" className="font-display text-[17px] font-semibold">
          Qualifier {contactName}
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          Le prospect a exprimé le désir de l'offre. Une affaire va être ouverte, pré-remplie
          depuis la fiche.
        </p>

        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setTouched(true);
            if (valid) onConfirm(parsed, offer);
          }}
        >
          <label className="grid gap-1">
            <span className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
              Montant (€)
            </span>
            <input
              autoFocus
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              // Vide plutôt qu'à zéro : un montant pré-rempli est un montant
              // qu'on oublie de corriger, et zéro pèse zéro dans la prévision.
              placeholder="6480"
              className="rounded-control border border-line bg-surface px-2.5 py-2 text-[14px] outline-none focus:border-brand"
            />
          </label>

          <label className="grid gap-1">
            <span className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
              Offre
            </span>
            {offers.length === 0 ? (
              <input
                value={offer}
                onChange={(event) => setOffer(event.target.value)}
                placeholder="Nom de l'offre"
                className="rounded-control border border-line bg-surface px-2.5 py-2 text-[14px] outline-none focus:border-brand"
              />
            ) : (
              <select
                value={offer}
                onChange={(event) => setOffer(event.target.value)}
                className="rounded-control border border-line bg-surface px-2.5 py-2 text-[14px] outline-none focus:border-brand"
              >
                {offers.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            )}
          </label>

          {touched && !valid && (
            <p className="text-[12.5px] text-[#B2311F]">{AMOUNT_REQUIRED}</p>
          )}
          {error !== null && <p className="text-[12.5px] text-[#B2311F]">{error}</p>}

          <div className="mt-1 flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-control bg-brand px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-d disabled:opacity-50"
            >
              {busy ? "Création…" : "Qualifier et créer l'affaire"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-control border border-line px-3.5 py-2 text-[13px] font-semibold transition-colors hover:bg-surface-2"
            >
              Annuler
            </button>
          </div>
          <p className="text-[11.5px] text-muted">
            Annuler laisse la fiche telle qu'elle est — aucun changement de cycle de vie.
          </p>
        </form>
      </div>
    </>
  );
}
