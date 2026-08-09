"use client";

import { useEffect, useState } from "react";
import { logActivity } from "@/lib/client/activity-api";
import {
  DEFAULT_REMINDER_DELAYS,
  proposedReminder,
  type ReminderDelays,
} from "@/lib/domain/automation";
import { requestJson } from "@/lib/client/http";
import { toActivityType } from "@/lib/domain/guards";
import { proposalFor, type Outcome } from "@/lib/domain/status";
import { OutcomeFields } from "./outcome-fields";
import type { ComboboxValue } from "@/components/ui/combobox";
import { ACTIVITY_LABELS, ACTIVITY_TYPES, type ActivityType } from "@/lib/domain/types";
import type { RecordLink } from "./record-link";

/**
 * Consignation d'une interaction.
 *
 * « Prochaine action » est le champ qui compte : c'est lui qui transforme un
 * compte rendu en relance datée. Intitulé et échéance vont ensemble — l'un sans
 * l'autre est refusé côté serveur, et le formulaire pré-remplit l'échéance à
 * J+7 dès qu'un intitulé est saisi, pour que le cas courant ne demande qu'une
 * frappe.
 *
 * Sur un contact, le formulaire propose en plus une **date de relance** déduite
 * du type d'interaction (délais configurables dans /reglages). C'est une
 * proposition, pas une écriture : la case se décoche, la date se change, et rien
 * n'est posé si le contact porte déjà une relance plus lointaine.
 */
interface LogFormProps {
  readonly link: RecordLink;
  readonly owners: readonly string[];
  readonly defaultOwner: string;
  readonly currentReminder?: Date | null;
  /** Statut actuellement saisi sur la fiche, pour le pré-remplir. */
  readonly currentStatus?: string;
  /** Statuts déjà employés ailleurs, proposés avant la liste de départ. */
  readonly statusSuggestions?: readonly string[];
  readonly onCancel: () => void;
  /** Reçoit le résumé de ce qui a été créé, pour que rien ne soit muet. */
  readonly onLogged: (summary: string) => void;
}

const CONTROL =
  "w-full rounded-control border border-line bg-surface px-2.5 py-2 text-[13.5px] outline-none focus:border-flux";

function isoDay(offsetDays = 0): string {
  const day = new Date();
  day.setDate(day.getDate() + offsetDays);
  return day.toISOString().slice(0, 10);
}

function isoOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isDelays(value: unknown): value is { delays: ReminderDelays } {
  return typeof value === "object" && value !== null && "delays" in value;
}

export function LogForm({
  link,
  owners,
  defaultOwner,
  currentReminder = null,
  currentStatus = "",
  statusSuggestions = [],
  onCancel,
  onLogged,
}: LogFormProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [nextTitle, setNextTitle] = useState("");
  const [delays, setDelays] = useState<ReminderDelays>(DEFAULT_REMINDER_DELAYS);
  const [type, setType] = useState<ActivityType>("call");
  const [date, setDate] = useState(isoDay());
  const [remind, setRemind] = useState(true);
  const [reminderDate, setReminderDate] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | "">("");
  const [status, setStatus] = useState<ComboboxValue>(
    currentStatus === "" ? { kind: "none" } : { kind: "existing", id: currentStatus },
  );
  const [lostReason, setLostReason] = useState("");

  // L'issue choisie **propose** : chaque champ reste modifiable ensuite. C'est
  // ce qui distingue un pré-remplissage utile d'une décision prise à sa place.
  const outcomePlan = outcome === "" ? null : proposalFor(outcome);

  const chooseOutcome = (value: Outcome) => {
    setOutcome(value);
    const next = proposalFor(value);
    setStatus({ kind: "existing", id: next.status });
    if (next.clearReminder) setRemind(false);
    if (next.focusReminder) setRemind(true);
    if (!next.needsLostReason) setLostReason("");
  };

  // Les délais vivent dans les réglages : les recopier ici les figerait.
  useEffect(() => {
    let alive = true;
    void requestJson("/api/settings", { method: "GET" }, isDelays).then((result) => {
      if (alive && result.ok) setDelays(result.data.delays);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Une relance ne se propose que sur un contact : c'est la fiche qui porte le
  // champ `nextReminder`, une société ou une affaire n'en a pas.
  const canRemind = link.contactId !== undefined && link.contactId !== null;
  const parsedDate = new Date(`${date}T00:00:00`);
  const proposal =
    !canRemind || Number.isNaN(parsedDate.getTime())
      ? null
      : proposedReminder({
          type,
          interactionDate: parsedDate,
          existingReminder: currentReminder,
          delays,
        });

  // La date affichée suit la proposition tant que l'utilisateur n'a rien saisi.
  const shownReminder = reminderDate ?? (proposal === null ? null : isoOf(proposal));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();

    const duration = text("duration");
    const nextAction =
      text("nextTitle") === ""
        ? null
        : {
            title: text("nextTitle"),
            due: text("nextDue"),
            priority: text("nextPriority"),
          };

    if (outcome === "") {
      setError("Choisissez le résultat de l'échange.");
      return;
    }

    setBusy(true);
    setError(null);
    setFields({});

    // `null` **efface** la relance ; `undefined` la laisse telle quelle. La
    // distinction compte : « pas intéressé » doit retirer une échéance déjà
    // posée, alors qu'une simple note ne doit toucher à rien.
    const setReminder =
      remind && shownReminder !== null
        ? shownReminder
        : outcomePlan?.clearReminder === true
          ? null
          : undefined;

    const statusValue =
      status.kind === "existing" ? status.id : status.kind === "new" ? status.name : "";

    const result = await logActivity({
      ...link,
      type: text("type"),
      date: text("date"),
      owner: text("owner"),
      notes: String(form.get("notes") ?? ""),
      duration: duration === "" ? null : Number(duration),
      nextAction,
      setReminder,
      outcome,
      status: statusValue,
      lifecycle: outcomePlan?.lifecycle ?? undefined,
      lostReason: outcomePlan?.needsLostReason === true ? lostReason : undefined,
    });

    setBusy(false);
    if (result.ok) {
      const created = [
        nextAction === null ? null : `la tâche « ${nextAction.title} »`,
        statusValue === "" ? null : `le statut « ${statusValue} »`,
        setReminder === null || setReminder === undefined
          ? null
          : `une relance le ${new Date(`${setReminder}T00:00:00`).toLocaleDateString("fr-FR")}`,
      ].filter((part): part is string => part !== null);

      onLogged(
        created.length === 0
          ? "Interaction consignée."
          : `Interaction consignée, avec ${created.join(" et ")} — visible dans /taches.`,
      );
      return;
    }
    setError(result.message);
    setFields(result.fields ?? {});
  };

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="grid gap-3 rounded-card border border-line bg-surface-2 px-3.5 py-3.5"
    >
      <div className="grid grid-cols-3 gap-2.5">
        <Field label="Type" errors={fields.type}>
          <select
            name="type"
            value={type}
            onChange={(event) => setType(toActivityType(event.target.value))}
            className={CONTROL}
          >
            {ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {ACTIVITY_LABELS[type]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date" errors={fields.date}>
          <input
            name="date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={CONTROL}
          />
        </Field>
        <Field label="Durée (min)" errors={fields.duration}>
          <input name="duration" type="number" min={0} className={CONTROL} />
        </Field>
      </div>

      <Field label="Propriétaire" errors={fields.owner}>
        <select name="owner" defaultValue={defaultOwner} className={CONTROL}>
          {owners.map((owner) => (
            <option key={owner}>{owner}</option>
          ))}
        </select>
      </Field>

      <Field label="Notes" errors={fields.notes}>
        <textarea name="notes" rows={3} className={CONTROL} placeholder="Ce qui s'est dit…" />
      </Field>

      <fieldset className="grid gap-2.5 rounded-control border border-line bg-surface px-3 py-2.5">
        <legend className="px-1 font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
          Prochaine action
        </legend>
        <input
          name="nextTitle"
          value={nextTitle}
          onChange={(event) => setNextTitle(event.target.value)}
          placeholder="Rappeler pour la proposition…"
          className={CONTROL}
        />
        {fields.nextAction !== undefined && (
          <span className="text-[12px] text-[#B2311F]">{fields.nextAction.join(" · ")}</span>
        )}
        {nextTitle.trim() !== "" && (
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Échéance" errors={fields["nextAction.due"]}>
              <input name="nextDue" type="date" defaultValue={isoDay(7)} className={CONTROL} />
            </Field>
            <Field label="Priorité">
              <select name="nextPriority" defaultValue="normale" className={CONTROL}>
                <option value="haute">Haute</option>
                <option value="normale">Normale</option>
                <option value="basse">Basse</option>
              </select>
            </Field>
          </div>
        )}
        <p className="text-[11.5px] leading-relaxed text-muted">
          Renseignée, elle crée une tâche datée dans la même transaction, rattachée à
          cette fiche. Laissée vide, rien n'est créé.
        </p>
      </fieldset>

      <OutcomeFields
        outcome={outcome}
        onOutcome={chooseOutcome}
        status={status}
        onStatus={setStatus}
        lostReason={lostReason}
        onLostReason={setLostReason}
        needsLostReason={outcomePlan?.needsLostReason === true}
        lifecycle={outcomePlan?.lifecycle ?? null}
        suggestions={statusSuggestions}
        error={fields.outcome}
      />

      {shownReminder !== null && outcomePlan?.clearReminder !== true && (
        <fieldset className="grid gap-2.5 rounded-control border border-line bg-surface px-3 py-2.5">
          <legend className="px-1 font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
            Relance du contact
          </legend>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={remind}
              onChange={(event) => setRemind(event.target.checked)}
            />
            Poser une relance après {ACTIVITY_LABELS[type].toLowerCase()}
          </label>
          {remind && (
            <input
              type="date"
              value={shownReminder}
              onChange={(event) => setReminderDate(event.target.value)}
              aria-label="Date de relance"
              className={CONTROL}
            />
          )}
          <p className="text-[11.5px] leading-relaxed text-muted">
            La date est posée sur la fiche et une tâche « Relancer… » apparaît dans /taches.
            Une seule par contact : la reposer déplace la même tâche.
          </p>
        </fieldset>
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
          className="rounded-control bg-flux px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-flux-d disabled:opacity-50"
        >
          {busy ? "Enregistrement…" : "Consigner"}
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
