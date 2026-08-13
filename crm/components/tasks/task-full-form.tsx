"use client";

import { useState } from "react";
import { createTask } from "@/lib/client/activity-api";
import { TASK_PRIORITIES } from "@/lib/domain/types";
import type { TaskTargets } from "./tasks-view";

/**
 * Création d'une tâche depuis la vue Tâches, où aucune fiche n'est ouverte : le
 * rattachement se choisit donc explicitement, en deux temps — d'abord le type de
 * fiche, puis laquelle. Un seul rattachement à la fois, comme le refuse l'API.
 */
interface TaskFullFormProps {
  readonly owners: readonly string[];
  readonly targets: TaskTargets;
  readonly onCancel: () => void;
  readonly onCreated: () => void;
}

const CONTROL =
  "w-full rounded-control border border-line bg-surface px-2.5 py-2 text-[13.5px] outline-none focus:border-brand";

type TargetKind = "none" | "contact" | "company" | "deal";

function isoDay(offset = 0): string {
  const day = new Date();
  day.setDate(day.getDate() + offset);
  return day.toISOString().slice(0, 10);
}

export function TaskFullForm({ owners, targets, onCancel, onCreated }: TaskFullFormProps) {
  const [kind, setKind] = useState<TargetKind>("none");
  const [targetId, setTargetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  const options =
    kind === "contact"
      ? targets.contacts
      : kind === "company"
        ? targets.companies
        : kind === "deal"
          ? targets.deals
          : [];

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();

    setBusy(true);
    setError(null);
    setFields({});

    const link =
      kind === "none" || targetId === ""
        ? {}
        : kind === "contact"
          ? { contactId: targetId }
          : kind === "company"
            ? { companyId: targetId }
            : { dealId: targetId };

    const result = await createTask({
      ...link,
      title: text("title"),
      due: text("due"),
      priority: text("priority"),
      owner: text("owner"),
    });

    setBusy(false);
    if (result.ok) {
      onCreated();
      return;
    }
    setError(result.message);
    setFields(result.fields ?? {});
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-3.5">
      <Field label="Intitulé" errors={fields.title}>
        <input name="title" required className={CONTROL} placeholder="Relancer par téléphone…" />
      </Field>

      <div className="grid grid-cols-3 gap-2.5">
        <Field label="Échéance" errors={fields.due}>
          <input name="due" type="date" defaultValue={isoDay(3)} className={CONTROL} />
        </Field>
        <Field label="Priorité" errors={fields.priority}>
          <select name="priority" defaultValue="normale" className={CONTROL}>
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>
        </Field>
        <Field label="Propriétaire" errors={fields.owner}>
          <select name="owner" defaultValue={owners[0] ?? ""} className={CONTROL}>
            {owners.map((owner) => (
              <option key={owner}>{owner}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Rattacher à">
          <select
            value={kind}
            onChange={(event) => {
              const next = event.target.value;
              setKind(
                next === "contact" || next === "company" || next === "deal" ? next : "none",
              );
              setTargetId("");
            }}
            className={CONTROL}
          >
            <option value="none">Rien</option>
            <option value="contact">Un contact</option>
            <option value="company">Une société</option>
            <option value="deal">Une affaire</option>
          </select>
        </Field>
        {kind !== "none" && (
          <Field label="Fiche">
            <select
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              className={CONTROL}
            >
              <option value="">Choisir…</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

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
          {busy ? "Création…" : "Créer la tâche"}
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
