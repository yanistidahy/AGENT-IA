import type { WeekPace } from "@/lib/domain/timeline";

/**
 * **« Semaine en cours » : la cadence, jour par jour.**
 *
 * Composant **serveur** : il n'y a rien à cliquer et rien à survoler, donc rien
 * à envoyer au navigateur — la convention du jalon 5 s'applique pleinement ici.
 *
 * La bande répond à une question que la pastille hebdomadaire ne répond pas :
 * « suis-je dans les temps *aujourd'hui* ? ». La pastille dit 44 sur 100 ; elle
 * ne dit pas si 44 un mardi est bon ou mauvais. La ligne de cadence le dit, et
 * elle le dit **en jours ouvrés** : étaler cent messages sur sept jours
 * afficherait un retard le lundi matin qu'aucune décision n'a créé.
 *
 * Tout vient de `weekPace` : aucun cumul, aucune division ici.
 */
export function WeekPaceStrip({ pace }: { readonly pace: WeekPace }) {
  const peak = Math.max(pace.target, ...pace.days.map((day) => day.cumulative), 1);

  return (
    <section className="rounded-card border border-line bg-surface p-3.5" data-week-pace>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[15px] font-semibold tracking-tight">
          Semaine en cours
          <span className="ml-2 text-[12px] font-normal text-muted">
            cumul contre la cadence de {pace.target}
          </span>
        </h2>
        <p
          className={`text-[12.5px] font-medium ${
            pace.gap >= 0 ? "text-win-d" : "text-ink-2"
          }`}
          data-pace-sentence
          data-pace-gap={pace.gap}
        >
          {pace.sentence}
        </p>
      </header>

      <ol className="mt-2.5 grid grid-cols-7 gap-1.5">
        {pace.days.map((day) => {
          const height = Math.round((day.cumulative / peak) * 100);
          const mark = Math.round((day.expected / peak) * 100);
          return (
            <li key={day.key} className="text-center" data-pace-day={day.key}>
              {/*
                Une colonne par jour, avec le trait de la cadence attendue. Un
                jour à venir reste vide et grisé : on ne compare pas ce qui n'a
                pas eu lieu.
              */}
              <div
                className={`relative h-16 overflow-hidden rounded-control border ${
                  day.elapsed ? "border-line bg-brand-l/30" : "border-line-2 bg-line-2/30"
                }`}
              >
                <div
                  className={`absolute bottom-0 left-0 right-0 ${
                    day.cumulative >= day.expected ? "bg-win" : "bg-brand"
                  }`}
                  style={{ height: `${height}%` }}
                />
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-brand-d"
                  style={{ bottom: `${mark}%` }}
                  aria-hidden
                />
              </div>
              <p className="mt-1 text-[10.5px] text-muted">{day.label}</p>
              <p
                className={`text-[11.5px] ${day.elapsed ? "text-ink" : "text-muted"}`}
                data-pace-cumulative={day.cumulative}
              >
                {day.elapsed ? day.cumulative : "—"}
              </p>
            </li>
          );
        })}
      </ol>

      <p className="mt-2 text-[11.5px] text-muted">
        Le trait pointillé est le cumul attendu à la fin de chaque jour ouvré, la cible répartie sur
        cinq jours. Le week-end n&apos;en ajoute pas : le produit n&apos;envoie pas.
      </p>
    </section>
  );
}
