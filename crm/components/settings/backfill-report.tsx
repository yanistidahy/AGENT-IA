"use client";

/**
 * Le compte rendu du rattrapage depuis « Envoyés ».
 *
 * Extrait du panneau parce qu'il le poussait au-delà des 250 lignes : un
 * tableau de comparaison « stocké contre réel » est un composant à lui seul, et
 * c'est celui qu'on relit avant d'écrire.
 */
/** Ce que le rattrapage depuis « Envoyés » rend. */
export interface Backfill {
  fixes: Array<{ subject: string; toAddress: string; stored: string; real: string }>;
  already: number;
  unknown: number;
  ambiguous: string[];
  examined: number;
  applied: number;
  mailbox: string;
  knownSent: number;
  error: string | null;
}

export interface Relink {
  orphans: number;
  relinked: number;
  unmatched: number;
}

export function BackfillReport({ data }: { readonly data: { report: Backfill; relink: Relink } }) {
  const { report, relink } = data;

  return (
    <div className="mt-3 rounded-card border border-line bg-surface-2 p-3">
      <p className="text-[11.5px] text-muted">
        Dossier relevé : <b className="font-semibold text-ink">{report.mailbox || "—"}</b> ·{" "}
        {report.examined} message{report.examined > 1 ? "s" : ""} lu
        {report.examined > 1 ? "s" : ""} · {report.knownSent} ligne
        {report.knownSent > 1 ? "s" : ""} d'envoi dans la fenêtre
      </p>
      <p className="mt-1 text-[12px] text-ink">
        <b className="font-semibold">
          {report.applied > 0
            ? `${report.applied} identifiant${report.applied > 1 ? "s" : ""} corrigé${report.applied > 1 ? "s" : ""}`
            : `${report.fixes.length} identifiant${report.fixes.length > 1 ? "s" : ""} à corriger`}
        </b>{" "}
        · {report.already} déjà correct{report.already > 1 ? "s" : ""} · {report.unknown} message
        {report.unknown > 1 ? "s" : ""} sans envoi correspondant
      </p>

      {relink.orphans > 0 && (
        <p className="mt-1 text-[12px] text-ink">
          <b className="font-semibold">
            {relink.orphans} envoi{relink.orphans > 1 ? "s" : ""} sans fiche rattachée
          </b>{" "}
          — {relink.relinked} rattachable{relink.relinked > 1 ? "s" : ""} par adresse,{" "}
          {relink.unmatched} sans fiche correspondante. Sans rattachement, une réponse
          détectée n'écrit aucune interaction.
        </p>
      )}

      {report.ambiguous.length > 0 && (
        <div className="mt-2">
          <p className="text-[11.5px] font-semibold text-[#9A6410]">
            {report.ambiguous.length} cas laissé{report.ambiguous.length > 1 ? "s" : ""} de côté
            (à traiter à la main) :
          </p>
          <ul className="mt-1 space-y-0.5">
            {report.ambiguous.map((line, index) => (
              <li key={`${line}-${index}`} className="text-[11px] text-muted">
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.fixes.length > 0 && (
        <div className="mt-2 max-h-[32vh] overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Message", "Stocké (faux)", "Réel (dans « Envoyés »)"].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="border-b border-line px-2 py-1 text-left font-mono text-[9.5px] tracking-[0.1em] text-muted uppercase"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.fixes.map((fix) => (
                <tr key={fix.real}>
                  <td className="max-w-[22ch] truncate border-b border-line-2 px-2 py-1 text-[11px] text-muted">
                    {fix.toAddress} · {fix.subject}
                  </td>
                  <td className="max-w-[20ch] truncate border-b border-line-2 px-2 py-1 font-mono text-[10.5px] text-muted">
                    {fix.stored || "(vide)"}
                  </td>
                  <td className="max-w-[20ch] truncate border-b border-line-2 px-2 py-1 font-mono text-[10.5px] text-ink">
                    {fix.real}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


const BUTTON =
  "rounded-control px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-50";

/**
 * Le bloc entier : ce que le rattrapage fait, les deux boutons, le compte rendu.
 *
 * **Deux boutons distincts plutôt qu'une case à cocher** : « Simuler » et
 * « Appliquer » ne se confondent pas au clic, et c'est une écriture sur le
 * journal des envois. « Appliquer » reste inerte tant qu'une simulation n'a
 * rien trouvé à corriger — on n'écrit pas ce qu'on n'a pas relu.
 */
export function BackfillSection({
  busy,
  data,
  onRun,
}: {
  readonly busy: boolean;
  readonly data: { report: Backfill; relink: Relink } | null;
  readonly onRun: (apply: boolean) => void;
}) {
  return (
    <div className="mt-4 border-t border-line pt-3">
      <h4 className="font-display text-[13.5px] font-semibold text-ink">
        Rattraper les identifiants depuis « Envoyés »
      </h4>
      <p className="mt-1 text-[12px] text-muted">
        Jusqu'au jalon 44, le journal des envois enregistrait un{" "}
        <code>Message-ID</code> fabriqué par la bibliothèque d'envoi au lieu de celui
        réellement écrit dans le message. Les réponses à ces messages ne peuvent pas être
        rapprochées.{" "}
        <b className="font-semibold text-ink">
          Le dossier « Envoyés » porte le vrai identifiant
        </b>{" "}
        : cette action l'y lit — en-têtes seuls, en lecture seule — et corrige la seule
        colonne <code>messageId</code>. Une correspondance douteuse est signalée, jamais
        tranchée.
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onRun(false)}
          className={`${BUTTON} border border-line bg-surface hover:bg-paper`}
        >
          Simuler
        </button>
        <button
          type="button"
          disabled={busy || data === null || data.report.fixes.length === 0}
          onClick={() => onRun(true)}
          className={`${BUTTON} bg-brand text-white hover:bg-brand-d`}
        >
          Appliquer
        </button>
      </div>

      {data !== null && <BackfillReport data={data} />}
    </div>
  );
}
