"use client";

/**
 * « Vider les départs » — le bouton et sa confirmation.
 *
 * Extrait de la vue pour que celle-ci tienne sous la limite de 250 lignes une
 * fois la file réorganisée en cartes groupées. **La décision d'écrire reste
 * chez l'appelant** (`onConfirm`) : ce composant ne connaît ni la route, ni la
 * portée, il rend un geste et sa promesse.
 */
export function DeparturesClear({
  count,
  scoped,
  open,
  busy,
  onOpen,
  onCancel,
  onConfirm,
}: {
  readonly count: number;
  /** La file est bornée à une campagne : la confirmation le dit. */
  readonly scoped: boolean;
  readonly open: boolean;
  readonly busy: boolean;
  readonly onOpen: () => void;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  /*
    **Absent quand la file est vide**, jamais grisé : un bouton inerte se
    cherche, un bouton absent ne pose pas la question (jalon 26).
  */
  if (!open) {
    if (count === 0) return null;
    return (
      <button
        type="button"
        onClick={onOpen}
        disabled={busy}
        className="mt-3 min-h-[44px] rounded-control border border-line px-3 text-[12.5px] font-semibold text-ink hover:border-danger hover:text-danger disabled:opacity-50 lg:min-h-0 lg:py-1.5"
      >
        Vider les départs
      </button>
    );
  }

  return (
    <div className="mt-3 max-w-[70ch] rounded-card border border-danger bg-surface p-3">
      <p className="text-[13px] font-semibold text-ink">
        Vider {count} départ{count > 1 ? "s" : ""} en attente
        {scoped ? " de cette campagne" : ""} ?
      </p>
      <p className="mt-1 text-[12.5px] text-muted">
        Seuls ces brouillons, jamais partis, disparaissent de la file. Les messages déjà envoyés
        restent dans /emails et sur les fiches, et aucune fiche de contact n&apos;est modifiée. Les
        personnes concernées restent inscrites : une prochaine composition pourra leur réécrire.
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="min-h-[44px] rounded-control bg-danger px-3 text-[12.5px] font-semibold text-white disabled:opacity-50 lg:min-h-0 lg:py-1.5"
        >
          Vider la file
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] rounded-control border border-line px-3 text-[12.5px] font-semibold text-ink lg:min-h-0 lg:py-1.5"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
