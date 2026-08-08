"use client";

import { useState, type ReactNode } from "react";
import { Combobox, companyFields, type ComboboxValue } from "@/components/ui/combobox";
import { createDeal, updateDeal } from "@/lib/client/deals-api";
import type { DealRecord } from "@/lib/api/deals";
import type { StageLike } from "@/lib/domain/types";

export interface DealFormOptions {
  readonly stages: readonly StageLike[];
  readonly owners: readonly string[];
  readonly offers: readonly string[];
  readonly companies: readonly { readonly id: string; readonly name: string }[];
  readonly contacts: readonly {
    readonly id: string;
    readonly firstName: string;
    readonly lastName: string;
  }[];
}

interface DealFormProps extends DealFormOptions {
  readonly deal: DealRecord | null;
  readonly onSaved: () => void;
  readonly onCancel: () => void;
}

function toDateInput(date: Date | null): string {
  if (date === null) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

const INPUT =
  "w-full rounded-control border border-line bg-surface px-3 py-2 text-[13.5px] outline-none focus:border-flux focus:ring-3 focus:ring-flux/15";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string[] | undefined;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[9.5px] tracking-[0.12em] text-muted uppercase">
        {label}
      </span>
      {children}
      {error !== undefined && (
        <span className="mt-1 block text-[11.5px] text-pulse">{error.join(" · ")}</span>
      )}
    </label>
  );
}

export function DealForm({
  deal,
  stages,
  owners,
  offers,
  companies,
  contacts,
  onSaved,
  onCancel,
}: DealFormProps) {
  const [form, setForm] = useState({
    name: deal?.name ?? "",
    amount: String(deal?.amount ?? 0),
    stageId: deal?.stageId ?? stages[0]?.id ?? "",
    owner: deal?.owner ?? owners[0] ?? "",
    offer: deal?.offer ?? offers[0] ?? "",
    contactId: deal?.contactId ?? "",
    expectedClose: toDateInput(deal?.expectedClose ?? null),
    prob: deal?.prob === null || deal?.prob === undefined ? "" : String(deal.prob),
    notes: deal?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  const [company, setCompany] = useState<ComboboxValue>(
    deal?.companyId == null ? { kind: "none" } : { kind: "existing", id: deal.companyId },
  );

  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    setFields({});

    const amount = Number.parseInt(form.amount, 10);
    const body = {
      name: form.name,
      amount: Number.isNaN(amount) ? 0 : amount,
      stageId: form.stageId,
      owner: form.owner,
      offer: form.offer,
      notes: form.notes,
      ...companyFields(company),
      contactId: form.contactId === "" ? null : form.contactId,
      expectedClose: form.expectedClose === "" ? null : form.expectedClose,
      prob: form.prob === "" ? null : Number.parseInt(form.prob, 10),
    };

    const result =
      deal === null ? await createDeal(body) : await updateDeal(deal.id, body);

    setBusy(false);
    if (result.ok) {
      onSaved();
      return;
    }
    setMessage(result.message);
    if (result.fields !== undefined) setFields(result.fields);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-3"
    >
      <Field label="Nom de l'affaire" error={fields.name}>
        <input
          className={INPUT}
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Assistant IA — [Société]"
          autoFocus
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Montant (€)" error={fields.amount}>
          <input
            className={INPUT}
            type="number"
            min={0}
            value={form.amount}
            onChange={(e) => set("amount", e.target.value)}
          />
        </Field>
        <Field label="Clôture prévue" error={fields.expectedClose}>
          <input
            className={INPUT}
            type="date"
            value={form.expectedClose}
            onChange={(e) => set("expectedClose", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Étape" error={fields.stageId}>
          <select
            className={INPUT}
            value={form.stageId}
            onChange={(e) => set("stageId", e.target.value)}
          >
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Propriétaire" error={fields.owner}>
          <select
            className={INPUT}
            value={form.owner}
            onChange={(e) => set("owner", e.target.value)}
          >
            {owners.map((owner) => (
              <option key={owner}>{owner}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Société">
          <Combobox
            options={companies.map((option) => ({ id: option.id, label: option.name }))}
            value={company}
            onChange={setCompany}
            placeholder="Rechercher ou créer une société…"
            emptyLabel="Sans société"
          />
        </Field>
        <Field label="Contact principal">
          <select
            className={INPUT}
            value={form.contactId}
            onChange={(e) => set("contactId", e.target.value)}
          >
            <option value="">—</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.firstName} {contact.lastName}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Offre">
        <select
          className={INPUT}
          value={form.offer}
          onChange={(e) => set("offer", e.target.value)}
        >
          <option value="">—</option>
          {offers.map((offer) => (
            <option key={offer}>{offer}</option>
          ))}
        </select>
      </Field>

      <Field label="Probabilité (laisser vide = celle de l'étape)" error={fields.prob}>
        <input
          className={INPUT}
          type="number"
          min={0}
          max={100}
          value={form.prob}
          onChange={(e) => set("prob", e.target.value)}
          placeholder="—"
        />
      </Field>

      <Field label="Notes">
        <textarea
          className={`${INPUT} min-h-20 resize-y`}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </Field>

      {message !== null && (
        <p className="rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
          {message}
        </p>
      )}

      <div className="mt-1 flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-control bg-flux px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-flux-d disabled:bg-line disabled:text-muted"
        >
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-control border border-line px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-surface-2"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
