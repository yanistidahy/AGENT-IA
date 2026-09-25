"use client";

import { CAMPAIGN_PATHS, type CampaignMode } from "@/lib/domain/campaign-mode";

/**
 * Le premier geste de la création : **quelle voie**.
 *
 * Deux cartes larges, pas une bascule dans un formulaire. La différence n'est
 * pas cosmétique : le jalon 87 avait posé le même choix en bascule, au fond
 * d'un bloc replié de l'éditeur de séquence, et personne ne l'a trouvé. Une
 * décision qui change tout le parcours se prend **avant** le parcours, à la
 * taille de ce qu'elle décide.
 *
 * **Rien n'est présélectionné** : sans choix, il n'y a pas de campagne à créer.
 * Un défaut silencieux ramènerait exactement le défaut qu'on corrige.
 */
export function CampaignPathChoice({
  value,
  onChange,
}: {
  readonly value: CampaignMode | null;
  readonly onChange: (mode: CampaignMode) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
        1 · Comment les messages sont-ils écrits ?
      </legend>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {CAMPAIGN_PATHS.map((path) => {
          const chosen = value === path.mode;
          return (
            <button
              key={path.mode}
              type="button"
              aria-pressed={chosen}
              onClick={() => onChange(path.mode)}
              className={`rounded-card border p-3.5 text-left transition-colors ${
                chosen
                  ? "border-brand bg-brand-l"
                  : "border-line bg-surface hover:border-brand hover:bg-surface-2"
              }`}
            >
              <span
                className={`block font-display text-[15px] font-semibold ${
                  chosen ? "text-brand-d" : "text-ink"
                }`}
              >
                {path.title}
              </span>
              <span className="mt-1 block text-[12.5px] leading-relaxed text-muted">
                {path.summary}
              </span>
              {/*
                Ce qui va se passer juste après le clic. Une carte qui ne dit
                que le nom de la voie fait choisir à l'aveugle, et l'on ne
                découvre le parcours qu'une fois la campagne créée.
              */}
              <ul className="mt-2 space-y-0.5">
                {path.next.map((line) => (
                  <li key={line} className="text-[11.5px] text-muted">
                    · {line}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
