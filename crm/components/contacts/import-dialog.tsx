"use client";

import { useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import type { ImportReport } from "@/lib/api/contact-import";
import { importContacts } from "@/lib/client/crm-api";
import { detectDelimiter, looksLikeHeader, mapHeaders, parseGrid } from "@/lib/domain/csv";

/**
 * Import de contacts par collage.
 *
 * L'aperçu est calculé dans le navigateur, avec le même code que le serveur
 * (`lib/domain/csv.ts` est pur, il tourne des deux côtés) : l'utilisateur voit
 * quelles colonnes ont été reconnues *avant* d'écrire quoi que ce soit en base.
 */
interface ImportDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onImported: () => void;
}

const DELIMITER_LABELS: Record<string, string> = {
  "\t": "tabulation",
  ";": "point-virgule",
  ",": "virgule",
};

export function ImportDialog({ open, onClose, onImported }: ImportDialogProps) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  // Décochée par défaut : un import qui modifie l'existant sans qu'on l'ait
  // demandé est une perte de données qui ne dit pas son nom.
  const [update, setUpdate] = useState(false);

  const grid = text.trim() === "" ? [] : parseGrid(text);
  const header = grid[0];
  const preview =
    header === undefined || !looksLikeHeader(header)
      ? null
      : { mapping: mapHeaders(header), rows: grid.length - 1 };

  const run = async () => {
    setBusy(true);
    setError(null);
    setReport(null);
    const result = await importContacts(text, update);
    setBusy(false);
    if (result.ok) {
      setReport(result.data.report);
      onImported();
    } else {
      setError(result.message);
    }
  };

  const close = () => {
    setText("");
    setReport(null);
    setError(null);
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      title="Importer des contacts"
      subtitle="Collez directement depuis Google Sheets ou Excel"
    >
      <p className="mb-3 text-[13px] leading-relaxed text-muted">
        Copiez vos lignes, en-tête comprise, et collez-les ci-dessous. Le séparateur est
        détecté automatiquement. Les colonnes sont reconnues par leur intitulé : Prénom, Nom,
        Email, Téléphone, Fonction, Société, Cycle de vie, Source, Propriétaire…
      </p>

      <textarea
        rows={9}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={"Prénom\tNom\tEmail\tSociété\nMarie\tDurand\tmarie@acme.fr\tACME"}
        className="w-full rounded-control border border-line bg-surface px-2.5 py-2 font-mono text-[12.5px] outline-none focus:border-brand"
      />

      <label className="mt-3 flex items-start gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={update}
          onChange={(event) => setUpdate(event.target.checked)}
          className="mt-0.5"
        />
        <span>
          Mettre à jour les contacts existants
          <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted">
            Le rapprochement se fait par adresse électronique, à défaut par nom + société.
            Seules les colonnes présentes dans le collage sont modifiées : une colonne absente
            ou une cellule vide ne vide jamais un champ, et rien n'est supprimé.
          </span>
        </span>
      </label>

      {text.trim() !== "" && (
        <div className="mt-3 rounded-card border border-line bg-surface-2 px-3.5 py-3 text-[12.5px]">
          {preview === null ? (
            <span className="text-[#B2311F]">
              La première ligne n'est pas reconnue comme un en-tête. Ajoutez une ligne de
              titres avant de coller.
            </span>
          ) : (
            <>
              <div>
                <b>{preview.rows}</b> ligne(s) de données · séparateur{" "}
                <b>{DELIMITER_LABELS[detectDelimiter(text)] ?? "inconnu"}</b>
              </div>
              <div className="mt-1 text-muted">
                Colonnes reconnues : {Object.keys(preview.mapping.columns).join(", ")}
              </div>
              {preview.mapping.ignored.length > 0 && (
                <div className="mt-1 text-muted">
                  Ignorées : {preview.mapping.ignored.join(", ")}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {error !== null && (
        <p className="mt-3 rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
          {error}
        </p>
      )}

      {report !== null && <ReportCard report={report} />}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={busy || preview === null}
          onClick={() => void run()}
          className="rounded-control bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-d disabled:opacity-45"
        >
          {busy ? "Import en cours…" : "Importer"}
        </button>
        <button
          type="button"
          onClick={close}
          className="rounded-control border border-line px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-surface-2"
        >
          Fermer
        </button>
      </div>
    </Drawer>
  );
}

function ReportCard({ report }: { report: ImportReport }) {
  return (
    <div className="mt-3 rounded-card border border-line bg-win-l px-3.5 py-3 text-[12.5px] text-win-d">
      <b className="font-display text-[14px]">
        {report.created} créé(s) · {report.updated} mis à jour · {report.duplicates} ignoré(s)
      </b>
      <ul className="mt-1.5 grid gap-0.5">
        {report.duplicates > 0 && (
          <li>{report.duplicates} ignoré(s) — déjà en base, rien à changer.</li>
        )}
        {report.companiesCreated.length > 0 && (
          <li>Sociétés créées : {report.companiesCreated.join(", ")}.</li>
        )}
        {report.ignoredColumns.length > 0 && (
          <li>Colonnes non reconnues : {report.ignoredColumns.join(", ")}.</li>
        )}
        {report.updates.map((entry) => (
          <li key={`maj-${entry.line}`}>
            <b className="font-semibold">{entry.name}</b>
            {entry.company === null ? "" : ` (${entry.company})`} :{" "}
            {entry.changes
              .map((change) => `${change.field} ${change.from} → ${change.to}`)
              .join(" · ")}
          </li>
        ))}
        {report.errors.map((issue) => (
          <li key={issue.line} className="text-[#B2311F]">
            Ligne {issue.line} : {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
