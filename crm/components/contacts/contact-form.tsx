"use client";

import { useState } from "react";
import type { ContactRecord } from "@/lib/api/contacts";
import { createContact, updateContact } from "@/lib/client/crm-api";
import { LIFECYCLES } from "@/lib/domain/types";

/**
 * Formulaire de contact, création et édition.
 *
 * Les erreurs par champ renvoyées par l'API sont affichées sous l'entrée
 * concernée : une validation serveur qui n'aboutit qu'à un message global oblige
 * l'utilisateur à deviner laquelle de ses douze saisies est en cause.
 */
export interface ContactFormOptions {
  readonly owners: readonly string[];
  readonly sources: readonly string[];
  readonly companies: ReadonlyArray<{ readonly id: string; readonly name: string }>;
}

interface ContactFormProps extends ContactFormOptions {
  readonly contact: ContactRecord | null;
  readonly companyId?: string | null;
  readonly onCancel: () => void;
  readonly onSaved: () => void;
}

const CONTROL =
  "w-full rounded-control border border-line bg-surface px-2.5 py-2 text-[13.5px] outline-none focus:border-flux";

function day(date: Date | null): string {
  return date === null ? "" : date.toISOString().slice(0, 10);
}

export function ContactForm({
  contact,
  companyId,
  owners,
  sources,
  companies,
  onCancel,
  onSaved,
}: ContactFormProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();

    const payload = {
      firstName: text("firstName"),
      lastName: text("lastName"),
      lifecycle: text("lifecycle"),
      title: text("title"),
      dep: text("dep"),
      email: text("email"),
      phone: text("phone"),
      linkedin: text("linkedin"),
      source: text("source"),
      owner: text("owner"),
      notes: String(form.get("notes") ?? ""),
      companyId: text("companyId") === "" ? null : text("companyId"),
      lastContact: text("lastContact"),
      nextReminder: text("nextReminder"),
    };

    setBusy(true);
    setError(null);
    setFields({});

    const result =
      contact === null
        ? await createContact(payload)
        : await updateContact(contact.id, payload);

    setBusy(false);
    if (result.ok) {
      onSaved();
      return;
    }
    setError(result.message);
    setFields(result.fields ?? {});
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-3.5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Prénom" errors={fields.firstName}>
          <input name="firstName" required defaultValue={contact?.firstName ?? ""} className={CONTROL} />
        </Field>
        <Field label="Nom" errors={fields.lastName}>
          <input name="lastName" required defaultValue={contact?.lastName ?? ""} className={CONTROL} />
        </Field>
        <Field label="Fonction" errors={fields.title}>
          <input name="title" defaultValue={contact?.title ?? ""} className={CONTROL} />
        </Field>
        <Field label="Département" errors={fields.dep}>
          <input name="dep" defaultValue={contact?.dep ?? ""} className={CONTROL} />
        </Field>
        <Field label="Email" errors={fields.email}>
          <input name="email" type="email" defaultValue={contact?.email ?? ""} className={CONTROL} />
        </Field>
        <Field label="Téléphone" errors={fields.phone}>
          <input name="phone" defaultValue={contact?.phone ?? ""} className={CONTROL} />
        </Field>
      </div>

      <Field label="LinkedIn" errors={fields.linkedin}>
        <input name="linkedin" defaultValue={contact?.linkedin ?? ""} className={CONTROL} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Société" errors={fields.companyId}>
          <select
            name="companyId"
            defaultValue={contact?.companyId ?? companyId ?? ""}
            className={CONTROL}
          >
            <option value="">Sans société</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cycle de vie" errors={fields.lifecycle}>
          <select name="lifecycle" defaultValue={contact?.lifecycle ?? "Lead"} className={CONTROL}>
            {LIFECYCLES.map((lifecycle) => (
              <option key={lifecycle}>{lifecycle}</option>
            ))}
          </select>
        </Field>
        <Field label="Propriétaire" errors={fields.owner}>
          <select name="owner" defaultValue={contact?.owner ?? ""} className={CONTROL}>
            <option value="">Non attribué</option>
            {owners.map((owner) => (
              <option key={owner}>{owner}</option>
            ))}
          </select>
        </Field>
        <Field label="Source" errors={fields.source}>
          <input
            name="source"
            list="contact-sources"
            defaultValue={contact?.source ?? ""}
            className={CONTROL}
          />
          <datalist id="contact-sources">
            {sources.map((source) => (
              <option key={source} value={source} />
            ))}
          </datalist>
        </Field>
        <Field label="Dernier contact" errors={fields.lastContact}>
          <input
            name="lastContact"
            type="date"
            defaultValue={day(contact?.lastContact ?? null)}
            className={CONTROL}
          />
        </Field>
        <Field label="Prochaine relance" errors={fields.nextReminder}>
          <input
            name="nextReminder"
            type="date"
            defaultValue={day(contact?.nextReminder ?? null)}
            className={CONTROL}
          />
        </Field>
      </div>

      <Field label="Notes" errors={fields.notes}>
        <textarea name="notes" rows={3} defaultValue={contact?.notes ?? ""} className={CONTROL} />
      </Field>

      {error !== null && (
        <p className="rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-control bg-flux px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-flux-d disabled:opacity-50"
        >
          {busy ? "Enregistrement…" : contact === null ? "Créer le contact" : "Enregistrer"}
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

function Field({
  label,
  errors,
  children,
}: {
  label: string;
  errors?: string[];
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
        {label}
      </span>
      {children}
      {errors !== undefined && errors.length > 0 && (
        <span className="mt-1 block text-[12px] text-[#B2311F]">{errors.join(" · ")}</span>
      )}
    </label>
  );
}
