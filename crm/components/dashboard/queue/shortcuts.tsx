/**
 * La légende des raccourcis.
 *
 * Discrète et permanente plutôt que cachée derrière un « ? » : un raccourci
 * qu'on ne découvre qu'en cherchant de l'aide est un raccourci que personne
 * n'utilise. Deux lignes de texte gris sous la file coûtent moins qu'une aide
 * qu'il faut penser à ouvrir.
 */
const KEYS: ReadonlyArray<{ key: string; what: string }> = [
  { key: "j", what: "descendre" },
  { key: "k", what: "monter" },
  { key: "espace", what: "sélectionner" },
  { key: "↵", what: "ouvrir la fiche" },
  { key: "c", what: "consigner un appel" },
];

export function Shortcuts() {
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted">
      {KEYS.map((entry) => (
        <span key={entry.key} className="inline-flex items-center gap-1">
          <kbd className="rounded border border-line bg-surface px-1 font-mono text-[10px]">
            {entry.key}
          </kbd>
          {entry.what}
        </span>
      ))}
    </p>
  );
}
