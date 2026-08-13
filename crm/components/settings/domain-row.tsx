"use client";

/**
 * Une proposition de domaine, avec ce qu'il faut pour la juger sans quitter
 * l'écran : d'où vient la valeur, et à quel point elle ressemble au nom.
 *
 * Le repère « ne ressemble pas au nom » est **discret et non bloquant**. Il ne
 * dit pas que la valeur est fausse : une agence n'a aucune obligation de
 * porter le nom de son domaine. Il dit que c'est ici que se cachent les
 * adresses erronées de la feuille — deux sociétés de cosmétique rattachées à
 * `teledyne.com` — et que ces lignes-là méritent le coup d'œil qu'on ne
 * donnera pas aux quatre-vingts autres.
 */
export interface DomainRow {
  companyId: string;
  company: string;
  value: string;
  rule: "email" | "name";
  confidence: "high" | "low";
  because: string;
  contacts: number;
  similarity: number;
  suspicious: boolean;
}

export function DomainRowItem({
  row,
  busy,
  onDecide,
}: {
  row: DomainRow;
  busy: boolean;
  onDecide: (action: "accept" | "reject") => void;
}) {
  const derived = row.rule === "email";

  return (
    <li
      className={`flex flex-wrap items-center gap-2 rounded-control border px-2.5 py-1.5 text-[12.5px] ${
        row.suspicious ? "border-[#F0DFB8] bg-gold-l/30" : "border-line bg-surface"
      }`}
    >
      <span className="min-w-0 flex-1">
        <b className="font-semibold">{row.company}</b>
        <span className="text-muted"> · {row.contacts} fiche(s)</span>
        <br />
        <span className="font-mono text-[12px]">{row.value}</span>{" "}
        <span
          className={`ml-1 rounded-full px-1.5 py-[1px] text-[10.5px] font-semibold ${
            derived ? "bg-brand-l text-brand-d" : "bg-gold-l text-[#9A6410]"
          }`}
        >
          {derived ? "déduit d'une adresse" : "supposé du nom"}
        </span>
        {row.confidence === "low" && derived && (
          <span className="ml-1 rounded-full bg-gold-l px-1.5 py-[1px] text-[10.5px] font-semibold text-[#9A6410]">
            ambigu
          </span>
        )}
        {row.suspicious && (
          <span
            title="Le domaine ne ressemble pas au nom de la société. C'est souvent le signe d'une adresse erronée dans la feuille — pas toujours."
            className="ml-1 rounded-full bg-gold-l px-1.5 py-[1px] text-[10.5px] font-semibold text-[#9A6410]"
          >
            ne ressemble pas au nom
          </span>
        )}
        <span className="mt-0.5 block text-[11px] text-muted">{row.because}</span>
      </span>

      <button
        type="button"
        disabled={busy}
        onClick={() => onDecide("accept")}
        className="rounded-control bg-brand px-2.5 py-1 text-[11.5px] font-semibold text-white transition-colors hover:bg-brand-d disabled:opacity-50"
      >
        Accepter
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onDecide("reject")}
        className="rounded-control border border-line px-2.5 py-1 text-[11.5px] font-semibold text-muted transition-colors hover:bg-paper disabled:opacity-50"
      >
        Écarter
      </button>
    </li>
  );
}
