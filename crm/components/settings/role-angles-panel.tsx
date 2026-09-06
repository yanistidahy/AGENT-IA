"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import type { RoleCoverage } from "@/lib/api/role-angles";
import { UnmatchedTitles } from "./unmatched-titles";
import { ColleagueWindow } from "./colleague-window";

/**
 * Ce qui compte pour chaque rôle, écrit une fois.
 *
 * La note rejoint le contexte entreprise et le mail de référence dans le prompt
 * d'Alex : c'est l'instruction **la plus spécifique** dont il dispose pour le
 * destinataire qu'il a en face. Elle est écrite à la main, dans les mots de
 * l'utilisateur — rien ici ne la génère ni ne la complète.
 *
 * Les étiquettes sont la partie ingrate et la plus utile : un même métier
 * s'appelle « Head of Customer Care », « Responsable service client » ou « SAV
 * Manager » selon le fichier. Ce sont elles qui décident de l'appariement, et
 * ce qu'elles ne couvrent pas s'affiche juste en dessous plutôt que de
 * disparaître dans un angle générique silencieux.
 */

const CONTROL =
  "w-full rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-brand";
const LABEL = "mb-1 block font-mono text-[10px] tracking-[0.1em] text-muted uppercase";

interface Draft {
  readonly name: string;
  readonly angle: string;
  readonly labels: string;
}

function toDraft(coverage: RoleCoverage): Draft[] {
  return coverage.roles.map((role) => ({
    name: role.name,
    angle: role.angle,
    // Une étiquette par ligne : c'est ce qui se colle depuis un tableur, et ce
    // qui se relit sans compter les virgules d'un champ unique.
    labels: role.labels.join("\n"),
  }));
}

function isCoverage(value: unknown): value is RoleCoverage {
  return typeof value === "object" && value !== null && "roles" in value && "unmatched" in value;
}

export function RoleAnglesPanel({
  initial,
  warningDays,
  onSaved,
}: {
  readonly initial: RoleCoverage;
  /** Fenêtre de l'avertissement « un collègue a déjà été écrit », en jours. */
  readonly warningDays: number;
  readonly onSaved: () => void;
}) {
  const [coverage, setCoverage] = useState(initial);
  const [draft, setDraft] = useState<Draft[]>(() => toDraft(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const patch = (index: number, change: Partial<Draft>) => {
    setSaved(false);
    setDraft((current) =>
      current.map((role, position) => (position === index ? { ...role, ...change } : role)),
    );
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const result = await requestJson(
      "/api/role-angles",
      {
        method: "PUT",
        body: JSON.stringify({
          roles: draft.map((role) => ({
            name: role.name,
            angle: role.angle,
            labels: role.labels
              .split("\n")
              .map((label) => label.trim())
              .filter((label) => label !== ""),
          })),
        }),
      },
      isCoverage,
    );
    setBusy(false);
    if (result.ok) {
      setCoverage(result.data);
      setDraft(toDraft(result.data));
      setSaved(true);
    } else {
      setError(result.message);
    }
  };

  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card">
      <p className="mb-3 text-[12px] text-muted">
        Alex reçoit la note du rôle qui correspond à la fonction du destinataire. Sans
        correspondance, il s'en tient au positionnement général — il n'invente pas d'angle à
        partir d'un intitulé.
      </p>

      <div className="space-y-3">
        {draft.map((role, index) => {
          const record = coverage.roles[index];
          return (
            <article key={index} className="rounded-control border border-line-2 p-3">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <label className="block flex-1 min-w-[200px]">
                  <span className={LABEL}>Rôle</span>
                  <input
                    value={role.name}
                    onChange={(event) => patch(index, { name: event.target.value })}
                    className={CONTROL}
                  />
                </label>
                <span className="text-[12px] text-muted">
                  {record === undefined
                    ? "nouveau"
                    : `${record.contacts} fiche${record.contacts > 1 ? "s" : ""}`}
                </span>
              </div>

              <label className="mb-2 block">
                <span className={LABEL}>Note d'angle</span>
                <textarea
                  rows={3}
                  value={role.angle}
                  placeholder="Ce qu'elle mesure, la douleur à nommer, ce qu'il faut éviter de promettre."
                  onChange={(event) => patch(index, { angle: event.target.value })}
                  className={CONTROL}
                />
              </label>

              <label className="block">
                <span className={LABEL}>Intitulés reconnus — un par ligne</span>
                <textarea
                  rows={3}
                  value={role.labels}
                  placeholder={"Responsable SAV\nHead of Customer Care\nSAV Manager"}
                  onChange={(event) => patch(index, { labels: event.target.value })}
                  className={`${CONTROL} font-mono text-[12px]`}
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  setSaved(false);
                  setDraft((current) => current.filter((_, position) => position !== index));
                }}
                className="mt-2 min-h-[44px] text-[12px] text-muted hover:text-danger lg:min-h-0"
              >
                Retirer ce rôle
              </button>
            </article>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setSaved(false);
            setDraft((current) => [...current, { name: "", angle: "", labels: "" }]);
          }}
          className="min-h-[44px] rounded-control border border-line px-3 text-[13px] hover:border-brand lg:min-h-0 lg:py-1.5"
        >
          Ajouter un rôle
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="min-h-[44px] rounded-control bg-brand px-3 text-[13px] font-medium text-white hover:bg-brand-d disabled:opacity-60 lg:min-h-0 lg:py-1.5"
        >
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
        {saved && <span className="text-[12px] text-win-d">Enregistré.</span>}
        {error !== null && <span className="text-[12px] text-danger">{error}</span>}
      </div>

      <ColleagueWindow days={warningDays} onSaved={onSaved} />

      <UnmatchedTitles
        unmatched={coverage.unmatched}
        withoutTitle={coverage.withoutTitle}
      />
    </section>
  );
}
