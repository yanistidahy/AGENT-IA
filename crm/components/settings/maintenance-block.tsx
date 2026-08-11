/**
 * Un bloc de correction : ce qu'il ferait, pourquoi, et le bouton.
 *
 * Extrait du panneau pour que celui-ci reste lisible à mesure que les
 * corrections s'accumulent — c'est la quatrième, et chacune a le même contrat :
 * un résumé chiffré, une phrase disant exactement quels champs sont touchés, le
 * détail ligne à ligne, et une seule action.
 */
export function MaintenanceBlock({
  title,
  summary,
  hint,
  disabled,
  onApply,
  children,
}: {
  title: string;
  summary: string;
  hint: string;
  disabled: boolean;
  onApply: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-line bg-surface-2 px-3.5 py-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <b className="font-display text-[13.5px] font-semibold">{title}</b>
        <span className="text-[12.5px] text-muted">{summary}</span>
        <button
          type="button"
          disabled={disabled}
          onClick={onApply}
          className="ml-auto rounded-control bg-brand px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-d disabled:opacity-50"
        >
          Appliquer
        </button>
      </div>
      <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{hint}</p>
      <ul className="mt-2 grid max-h-[240px] gap-0.5 overflow-y-auto text-[12px]">{children}</ul>
    </div>
  );
}
