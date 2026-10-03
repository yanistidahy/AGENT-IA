"use client";

import { useMemo, useState } from "react";
import { createTask } from "@/lib/client/activity-api";
import { foldSearch } from "@/lib/domain/task-tabs";
import { TASK_KINDS, TASK_KIND_LABELS, type TaskKind } from "@/lib/domain/task-kind";
import { TASK_PRIORITIES } from "@/lib/domain/types";

/**
 * « Créer une tâche » : un type, un assigné, un contact, une échéance.
 *
 * **Le type est saisi plutôt que deviné.** Jusqu'au jalon 104, l'onglet
 * « Appels » reconnaissait une tâche d'appel à son intitulé, faute de colonne
 * (jalon 92) : « Joindre Sophie » n'y entrait donc pas. Il est maintenant
 * demandé, avec `Tâche` pour défaut — une tâche dont on ne dit rien ne doit pas
 * atterrir dans la file d'appels du matin, qui n'a de valeur que si tout ce
 * qu'elle contient se traite au téléphone.
 *
 * **Le contact se cherche**, il ne se déroule pas : à cent cinquante fiches, un
 * `<select>` demande de faire défiler une liste pour trouver un nom qu'on
 * connaît déjà. Le champ filtre sur la clé pliée du jalon 72 — « eclat » trouve
 * « Éclat Naturel ».
 *
 * Le rattachement est **facultatif et unique** : l'API refuse deux cibles à la
 * fois, et c'est son refus qui fait foi (jalon 4).
 */
interface TaskFullFormProps {
  readonly people: readonly string[];
  readonly contacts: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly search: string;
  }>;
  readonly onCancel: () => void;
  readonly onCreated: () => void;
}

const CONTROL =
  "w-full rounded-control border border-line bg-surface px-2.5 py-2 text-[13.5px] outline-none focus:border-brand";

function isoDay(offset = 0): string {
  const day = new Date();
  day.setDate(day.getDate() + offset);
  return day.toISOString().slice(0, 10);
}

export function TaskFullForm({ people, contacts, onCancel, onCreated }: TaskFullFormProps) {
  const [kind, setKind] = useState<TaskKind>("tache");
  const [needle, setNeedle] = useState("");
  const [contactId, setContactId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  const chosen = contacts.find((contact) => contact.id === contactId) ?? null;

  /* Dix suggestions au plus : au-delà, la liste cesse d'aider à choisir. */
  const matches = useMemo(() => {
    const folded = foldSearch(needle);
    if (folded === "") return [];
    return contacts.filter((contact) => contact.search.includes(folded)).slice(0, 10);
  }, [contacts, needle]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();

    setBusy(true);
    setError(null);
    setFields({});

    const result = await createTask({
      title: text("title"),
      due: text("due"),
      priority: text("priority"),
      owner: text("owner"),
      kind,
      ...(contactId === "" ? {} : { contactId }),
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
      <Field label="Type">
        <div role="group" aria-label="Type de tâche" className="flex flex-wrap gap-1.5">
          {TASK_KINDS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              data-task-kind={value}
              onClick={() => setKind(value)}
              className={`inline-flex min-h-[44px] items-center rounded-control border px-3 py-2 text-[12.5px] font-semibold lg:min-h-0 ${
                kind === value
                  ? "border-brand bg-brand-l text-brand-d"
                  : "border-line bg-surface text-ink hover:bg-surface-2"
              }`}
            >
              {TASK_KIND_LABELS[value]}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Intitulé" errors={fields.title}>
        <input
          name="title"
          required
          data-field="title"
          className={CONTROL}
          placeholder={kind === "appel" ? "Appeler Nina pour le devis…" : "Préparer la proposition…"}
        />
      </Field>

      <div className="grid grid-cols-3 gap-2.5">
        <Field label="Échéance" errors={fields.due}>
          <input name="due" type="date" data-field="due" defaultValue={isoDay()} className={CONTROL} />
        </Field>
        <Field label="Priorité" errors={fields.priority}>
          <select name="priority" defaultValue="normale" className={CONTROL}>
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>
        </Field>
        <Field label="Assigné à" errors={fields.owner}>
          <select name="owner" data-field="owner" defaultValue={people[0] ?? ""} className={CONTROL}>
            {people.map((person) => (
              <option key={person}>{person}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Contact (facultatif)" errors={fields.contactId}>
        {chosen === null ? (
          <>
            <input
              value={needle}
              data-field="contact-search"
              onChange={(event) => setNeedle(event.target.value)}
              className={CONTROL}
              placeholder="Chercher un contact…"
            />
            {matches.length > 0 && (
              <div className="mt-1 grid gap-1 rounded-control border border-line bg-surface p-1">
                {matches.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    data-contact-option={contact.id}
                    onClick={() => {
                      setContactId(contact.id);
                      setNeedle("");
                    }}
                    className="rounded-control px-2 py-1.5 text-left text-[13px] hover:bg-surface-2"
                  >
                    {contact.label}
                  </button>
                ))}
              </div>
            )}
            {needle.trim() !== "" && matches.length === 0 && (
              <span className="mt-1 block text-[12px] text-muted">
                Aucun contact ne correspond. La tâche peut rester sans rattachement.
              </span>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 rounded-control border border-line bg-surface-2 px-2.5 py-2 text-[13px]">
            <span data-contact-chosen="1" className="font-semibold">
              {chosen.label}
            </span>
            <button
              type="button"
              onClick={() => setContactId("")}
              className="ml-auto text-[12.5px] text-muted hover:text-ink"
            >
              Retirer
            </button>
          </div>
        )}
      </Field>

      {kind === "appel" && chosen === null && (
        <p className="rounded-control border border-gold bg-gold-l px-3 py-2 text-[12.5px] text-ink">
          Sans contact rattaché, une tâche d&apos;appel n&apos;a ni numéro à composer ni
          historique où consigner l&apos;appel : « Appel passé » sera refusé.
        </p>
      )}

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
