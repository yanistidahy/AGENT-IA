"use client";

import { IdentityFields } from "./identity-fields";

import { LifecycleField } from "./lifecycle-field";

import { useState } from "react";
import { Combobox, companyFields, type ComboboxValue } from "@/components/ui/combobox";
import type { ContactRecord } from "@/lib/api/contacts";
import { createContact, updateContact } from "@/lib/client/crm-api";

import { isLost, LOST_REASONS } from "@/lib/domain/lost";

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
  /** Étiquettes déjà utilisées, proposées avant la liste de départ. */
  readonly tags?: readonly string[];
}

interface ContactFormProps extends ContactFormOptions {
  readonly contact: ContactRecord | null;
  readonly companyId?: string | null;
  readonly onCancel: () => void;
  /**
   * Le cycle de vie enregistré est rendu à l'appelant : c'est la fiche qui
   * reconnaît une entrée dans « Qualifié » et ouvre la modale de montant. Le
   * formulaire ne connaît pas les affaires.
   */
  readonly onSaved: (lifecycle: string) => void;
}

const CONTROL =
  "w-full rounded-control border border-line bg-surface px-2.5 py-2 text-[13.5px] outline-none focus:border-brand";

function day(date: Date | null): string {
  return date === null ? "" : date.toISOString().slice(0, 10);
}

export function ContactForm({
  contact,
  companyId,
  owners,
  sources,
  companies,
  tags = [],
  onCancel,
  onSaved,
}: ContactFormProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  const initialCompany = contact?.companyId ?? companyId ?? null;
  const [lifecycle, setLifecycle] = useState(contact?.lifecycle ?? "Lead");
  const [tag, setTag] = useState<ComboboxValue>(
    contact === null || contact.tag === ""
      ? { kind: "none" }
      : { kind: "existing", id: contact.tag },
  );
  const [company, setCompany] = useState<ComboboxValue>(
    initialCompany === null ? { kind: "none" } : { kind: "existing", id: initialCompany },
  );

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
      website: text("website"),
      source: text("source"),
      owner: text("owner"),
      tag: tag.kind === "existing" ? tag.id : tag.kind === "new" ? tag.name : "",
      // Le motif ne part que si la fiche est perdue : conserver un motif sur un
      // contact redevenu prospect ferait mentir la fiche, et l'opposition au
      // démarchage se lit sur ce champ.
      lostReason: isLost(lifecycle) ? text("lostReason") : "",
      notes: String(form.get("notes") ?? ""),
      ...companyFields(company),
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
      onSaved(lifecycle);
      return;
    }
    setError(result.message);
    setFields(result.fields ?? {});
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-3.5">
      <IdentityFields contact={contact} fields={fields} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Société" errors={fields.companyId ?? fields.companyName}>
          <Combobox
            options={companies.map((option) => ({ id: option.id, label: option.name }))}
            value={company}
            onChange={setCompany}
            placeholder="Rechercher ou créer une société…"
            emptyLabel="Sans société"
          />
        </Field>
        <LifecycleField
          value={lifecycle}
          errors={fields.lifecycle}
          onChange={setLifecycle}
        />
        <Field label="Étiquette" errors={fields.tag}>
          <Combobox
            options={TAG_OPTIONS(tags).map((value) => ({ id: value, label: value }))}
            value={tag}
            onChange={setTag}
            placeholder="Choisir ou créer une étiquette…"
            emptyLabel="Sans étiquette"
          />
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

      <p className="-mt-1 text-[11.5px] leading-relaxed text-muted">
        Une date de relance crée aussi la tâche « Relancer {"…"} » dans /taches, et l'y déplace si
        vous la changez. Effacer la date retire la tâche ; la terminer efface la date.
      </p>

      {isLost(lifecycle) && (
        <Field label="Motif de perte" errors={fields.lostReason}>
          <input
            name="lostReason"
            list="motifs-de-perte"
            defaultValue={contact?.lostReason ?? ""}
            placeholder="Budget, Timing, Concurrent…"
            className={CONTROL}
          />
          <datalist id="motifs-de-perte">
            {LOST_REASONS.map((reason) => (
              <option key={reason} value={reason} />
            ))}
          </datalist>
          <span className="mt-1 block text-[11.5px] leading-relaxed text-muted">
            « Ne souhaite plus être contacté » vaut opposition ferme : aucune séquence ni
            relance ne pourra plus viser cette personne, quel que soit son cycle de vie.
          </span>
        </Field>
      )}

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
          className="rounded-control bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-d disabled:opacity-50"
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

/** Liste proposée : les étiquettes déjà en usage d'abord, puis celles de départ. */
function TAG_OPTIONS(used: readonly string[]): string[] {
  const starters = [
    "À rappeler",
    "Devis envoyé",
    "En négociation",
    "Injoignable",
    "Pas intéressé",
    "Signature imminente",
  ];
  return [...new Set([...used, ...starters])];
}

/** La valeur d'un `<select>` est une chaîne : elle se vérifie, elle ne s'assère pas. */
