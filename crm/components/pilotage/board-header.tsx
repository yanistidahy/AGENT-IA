/**
 * L'en-tête du tableau de bord, identique sur les quatre onglets.
 *
 * Un seul composant plutôt qu'un titre recopié quatre fois : la phrase sous le
 * titre nomme la **période affichée**, et quatre copies finiraient par en
 * nommer trois différentes — c'est le genre d'écart qu'on met sur le dos d'un
 * bug de filtre.
 */
export function BoardHeader({ period }: { readonly period: string }) {
  return (
    <header className="mb-3" data-board-header>
      <h1 className="font-display text-xl font-semibold tracking-tight">Pilotage</h1>
      <p className="mt-0.5 text-[12.5px] text-closed" data-board-period>
        {period} · tout vient du journal des événements de prospection, une ligne par fait.
      </p>
    </header>
  );
}
