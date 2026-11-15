"use client";

import { useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { importVisitors, type VisitorsReport } from "@/lib/client/crm-api";

/**
 * **Coller une colonne de trafics, et voir ce qui va se passer avant.**
 *
 * Deux temps, et c'est le motif des corrections de `/reglages` depuis le jalon
 * 12 : **simuler** rend le rapport sans rien écrire, **appliquer** n'écrit que
 * les lignes que ce rapport annonçait. La même route sert les deux, donc le
 * rapport lu est le rapport appliqué — deux chemins séparés auraient fini par
 * rapprocher différemment, et l'aperçu n'aurait plus rien garanti.
 *
 * **Aucune société n'est créée**, et c'est dit à l'écran avant de coller : un
 * tableur d'audience contient des domaines qu'on ne prospecte pas, et les
 * laisser entrer peuplerait le CRM de maisons que personne n'a choisies. Les
 * lignes sans correspondance sont **nommées** dans le rapport, pour qu'on sache
 * lesquelles créer à la main si on le veut.
 */
const OUTCOME_LABELS: Readonly<Record<string, string>> = {
  updated: "à mettre à jour",
  unchanged: "déjà à jour",
  unmatched: "sans correspondance",
  ambiguous: "ambiguë",
  unreadable: "illisible",
};

export function VisitorsImportDialog({
  open,
  onClose,
  onImported,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onImported: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<VisitorsReport | null>(null);

  const run = async (apply: boolean) => {
    setBusy(true);
    setError(null);
    const result = await importVisitors(text, apply);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setReport(result.data.report);
    if (apply) onImported();
  };

  const close = () => {
    setText("");
    setReport(null);
    setError(null);
    onClose();
  };

  /** Les lignes qui n'aboutissent pas, nommées — jamais seulement comptées. */
  const problems = (report?.lines ?? []).filter(
    (line) => line.outcome !== "updated" && line.outcome !== "unchanged",
  );

  return (
    <Drawer open={open} title="Importer des trafics" onClose={close}>
      <p className="text-[13px] leading-relaxed text-muted">
        Collez deux colonnes : <b className="text-ink">domaine ou nom de société</b>, puis{" "}
        <b className="text-ink">visiteurs par mois</b>. Les noms sont rapprochés sans tenir compte
        de la casse ni des accents. <b className="text-ink">Aucune société n'est créée</b> : une
        ligne sans correspondance est signalée, pas importée.
      </p>

      <textarea
        data-visitors-import-text
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={8}
        placeholder={"zenithlabs.fr;8000\nMaison Clé;12 500\nStudio Kaolin;3k"}
        className="mt-3 w-full rounded-control border border-line bg-surface px-3 py-2 font-mono text-[12.5px] outline-none focus:border-brand"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          data-visitors-import-simulate
          disabled={busy || text.trim() === ""}
          onClick={() => void run(false)}
          className="rounded-control border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold transition-colors hover:bg-surface-2 disabled:opacity-50"
        >
          Simuler
        </button>
        <button
          type="button"
          data-visitors-import-apply
          disabled={busy || report === null || report.updated === 0}
          onClick={() => void run(true)}
          className="rounded-control bg-brand px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-d disabled:opacity-50"
        >
          {report === null
            ? "Appliquer"
            : `Appliquer ${report.updated} mise${report.updated > 1 ? "s" : ""} à jour`}
        </button>
      </div>

      {error !== null && (
        <p className="mt-3 rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
          {error}
        </p>
      )}

      {report !== null && (
        <section data-visitors-report className="mt-4">
          <p className="text-[13px]">
            <b data-visitors-report-read>{report.read}</b> ligne{report.read > 1 ? "s" : ""} lue
            {report.read > 1 ? "s" : ""} ·{" "}
            <b data-visitors-report-updated>{report.updated}</b>{" "}
            {report.applied ? "mise(s) à jour" : "à mettre à jour"} ·{" "}
            <b data-visitors-report-unchanged>{report.unchanged}</b> déjà à jour ·{" "}
            <b data-visitors-report-unmatched>{report.unmatched}</b> sans correspondance
            {report.ambiguous > 0 ? ` · ${report.ambiguous} ambiguë(s)` : ""}
            {report.unreadable > 0 ? ` · ${report.unreadable} illisible(s)` : ""}
          </p>
          {report.applied && (
            <p className="mt-1 text-[12.5px] text-win-d">
              Appliqué. Aucune société créée : l'import ne fait que remplir un nombre.
            </p>
          )}

          {problems.length > 0 && (
            <ul className="mt-2 grid gap-1">
              {problems.map((line) => (
                <li
                  key={`${line.line}-${line.raw}`}
                  data-visitors-problem={line.outcome}
                  className="rounded-control border border-line bg-surface-2 px-2.5 py-1.5 text-[12px]"
                >
                  <b>Ligne {line.line}</b> · « {line.raw} » — {OUTCOME_LABELS[line.outcome] ?? line.outcome}
                  {line.reason === "" ? "" : ` : ${line.reason}`}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </Drawer>
  );
}
