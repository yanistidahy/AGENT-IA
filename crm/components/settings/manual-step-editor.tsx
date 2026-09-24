"use client";

import { useRef } from "react";
import {
  MERGE_TAGS,
  renderSubject,
  renderTemplate,
  unknownTags,
  unresolvedTags,
  type MergeValues,
} from "@/lib/domain/merge-tags";

/**
 * L'éditeur d'une étape écrite à la main.
 *
 * **L'aperçu est la moitié de la fonction.** Un gabarit ne se relit pas : ce
 * qu'on veut voir avant d'enregistrer, c'est ce que *reçoit* quelqu'un — et
 * surtout ce que reçoit une fiche incomplète, parce que c'est le cas auquel on
 * ne pense pas. Il est donc rendu par **la même fonction que la composition**
 * (`lib/domain/merge-tags`), à la frappe, sans aller-retour : un aperçu calculé
 * autrement montrerait un texte que l'envoi ne produit pas.
 *
 * Les contacts d'aperçu sont **réels**, pris parmi les inscrits, et le cas
 * dégradé passe devant (`sampleContacts`).
 */

export interface SampleContact {
  readonly id: string;
  readonly name: string;
  readonly values: MergeValues;
}

const FIELD =
  "w-full rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] focus:border-brand focus:outline-none";

export function ManualStepEditor({
  subject,
  body,
  samples,
  sampleId,
  onSample,
  onChange,
}: {
  readonly subject: string;
  readonly body: string;
  readonly samples: readonly SampleContact[];
  readonly sampleId: string;
  readonly onSample: (id: string) => void;
  readonly onChange: (change: { subject?: string; body?: string }) => void;
}) {
  const area = useRef<HTMLTextAreaElement | null>(null);

  /** Insère la balise au curseur — et à la fin quand le champ n'a pas le focus. */
  const insert = (tag: string) => {
    const node = area.current;
    if (node === null) {
      onChange({ body: `${body}${tag}` });
      return;
    }
    const start = node.selectionStart;
    const end = node.selectionEnd;
    const next = `${body.slice(0, start)}${tag}${body.slice(end)}`;
    onChange({ body: next });
    // Le curseur reste après la balise : on continue de taper sa phrase.
    requestAnimationFrame(() => {
      node.focus();
      node.setSelectionRange(start + tag.length, start + tag.length);
    });
  };

  const sample = samples.find((entry) => entry.id === sampleId) ?? samples[0] ?? null;
  const values: MergeValues = sample?.values ?? { prenom: "", societe: "", site: "" };

  const missing = sample === null ? [] : unresolvedTags(`${subject}\n${body}`, values);
  const unknown = unknownTags(`${subject}\n${body}`);

  return (
    <div className="sm:col-span-2">
      <label className="block">
        <span className="block text-[11.5px] font-semibold text-muted">Objet</span>
        <input
          className={FIELD}
          value={subject}
          placeholder="ex. Une démonstration préparée pour {societe}"
          onChange={(event) => onChange({ subject: event.target.value })}
        />
      </label>

      <label className="mt-2 block">
        <span className="block text-[11.5px] font-semibold text-muted">Message</span>
        <textarea
          ref={area}
          className={`${FIELD} min-h-[180px] font-mono text-[12.5px] leading-relaxed`}
          value={body}
          placeholder={"Bonjour {prenom},\n\nEn regardant {societe}…"}
          onChange={(event) => onChange({ body: event.target.value })}
        />
      </label>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[11.5px] text-muted">Insérer :</span>
        {MERGE_TAGS.map((tag) => (
          <button
            key={tag.tag}
            type="button"
            title={tag.fallback}
            onClick={() => insert(tag.tag)}
            className="min-h-[44px] rounded-control border border-line bg-surface-2 px-2 font-mono text-[11.5px] text-ink hover:border-brand hover:text-brand-d lg:min-h-0 lg:py-1"
          >
            {tag.tag}
          </button>
        ))}
      </div>

      <p className="mt-1.5 text-[11.5px] text-muted">
        La signature est ajoutée à l&apos;envoi, comme pour un message d&apos;Alex — ne la
        retapez pas. Une balise sans valeur n&apos;est jamais envoyée telle quelle : sans
        prénom l&apos;appel devient « Bonjour, », et la phrase qui cite une société ou un
        site inconnus est retirée.
      </p>

      {unknown.length > 0 && (
        <p className="mt-1.5 rounded-control border border-danger bg-surface p-2 text-[11.5px] text-danger">
          Balise inconnue : {unknown.join(", ")}. Elle partirait telle quelle chez le
          destinataire. Les seules balises reconnues sont{" "}
          {MERGE_TAGS.map((tag) => tag.tag).join(", ")}.
        </p>
      )}

      {samples.length > 0 && sample !== null && (
        <div className="mt-2 rounded-card border border-line bg-surface-2 p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11.5px] font-semibold text-muted">Aperçu pour</span>
            <select
              className="rounded-control border border-line bg-surface px-2 py-1 text-[12px]"
              value={sample.id}
              onChange={(event) => onSample(event.target.value)}
            >
              {samples.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                  {entry.values.prenom.trim() === "" ? " — sans prénom" : ""}
                  {entry.values.site.trim() === "" ? " — sans site" : ""}
                </option>
              ))}
            </select>
          </div>

          {missing.length > 0 && (
            <p className="mt-1.5 text-[11.5px] text-muted">
              Pour cette fiche : {missing.join(", ")} sans valeur — voir le rendu ci-dessous.
            </p>
          )}

          <p className="mt-2 text-[11.5px] font-semibold text-muted">Objet</p>
          <p className="text-[12.5px] text-ink">{renderSubject(subject, values)}</p>
          <p className="mt-1.5 text-[11.5px] font-semibold text-muted">Message</p>
          <pre className="whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-ink">
            {renderTemplate(body, values)}
          </pre>
        </div>
      )}
    </div>
  );
}
