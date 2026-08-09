"use client";

import { useState } from "react";
import type { CompanyRecord } from "@/lib/api/companies";
import { createCompany, updateCompany } from "@/lib/client/crm-api";

interface CompanyFormProps {
  readonly company: CompanyRecord | null;
  readonly industries: readonly string[];
  readonly onCancel: () => void;
  readonly onSaved: () => void;
}

const CONTROL =
  "w-full rounded-control border border-line bg-surface px-2.5 py-2 text-[13.5px] outline-none focus:border-flux";

const SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"] as const;

export function CompanyForm({ company, industries, onCancel, onSaved }: CompanyFormProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();

    const payload = {
      name: text("name"),
      domain: text("domain"),
      size: text("size"),
      industry: text("industry"),
      loc: text("loc"),
      desc: String(form.get("desc") ?? ""),
    };

    setBusy(true);
    setError(null);
    setFields({});

    const result =
      company === null ? await createCompany(payload) : await updateCompany(company.id, payload);

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
      <Field label="Nom" errors={fields.name}>
        <input name="name" required defaultValue={company?.name ?? ""} className={CONTROL} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Domaine" errors={fields.domain}>
          <input
            name="domain"
            placeholder="exemple.fr"
            defaultValue={company?.domain ?? ""}
            className={CONTROL}
          />
        </Field>
        <Field label="Secteur" errors={fields.industry}>
          <input
            name="industry"
            list="company-industries"
            defaultValue={company?.industry ?? ""}
            className={CONTROL}
          />
          <datalist id="company-industries">
            {industries.map((industry) => (
              <option key={industry} value={industry} />
            ))}
          </datalist>
        </Field>
        <Field label="Taille" errors={fields.size}>
          <select name="size" defaultValue={company?.size ?? ""} className={CONTROL}>
            <option value="">Non renseignée</option>
            {SIZES.map((size) => (
              <option key={size}>{size}</option>
            ))}
          </select>
        </Field>
        <Field label="Localisation" errors={fields.loc}>
          <input name="loc" defaultValue={company?.loc ?? ""} className={CONTROL} />
        </Field>
      </div>

      <Field label="Description" errors={fields.desc}>
        <textarea name="desc" rows={3} defaultValue={company?.desc ?? ""} className={CONTROL} />
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
          {busy ? "Enregistrement…" : company === null ? "Créer la société" : "Enregistrer"}
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
