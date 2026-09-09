/**
 * « 47 départs en préparation » — la file qui se remplit, dite à l'écran.
 *
 * **Composant serveur, rendu à chaque chargement.** Une composition de fond
 * n'envoie rien vers le navigateur : sans cette bande, la file paraîtrait vide
 * ou incomplète exactement pendant qu'elle se remplit, et c'est le malentendu
 * que ce jalon existe pour supprimer. Recharger la montre avancer.
 *
 * Une composition **interrompue** se voit elle aussi : son journal reste ouvert
 * sans avancer, ou porte son erreur en clair. Un travail de fond qui échoue en
 * silence serait pire que pas de travail de fond — on attendrait des brouillons
 * qui ne viendront jamais.
 */
export interface CompositionProgress {
  readonly campaignId: string;
  readonly total: number;
  readonly done: number;
  readonly running: boolean;
  readonly error: string;
}

export function CompositionBanner({ jobs }: { readonly jobs: readonly CompositionProgress[] }) {
  const shown = jobs.filter((job) => job.running || job.error !== "");
  if (shown.length === 0) return null;

  return (
    <div className="mb-3 space-y-2">
      {shown.map((job) => (
        <div
          key={job.campaignId}
          className={`rounded-card border px-3 py-2 text-[12.5px] ${
            job.error === "" ? "border-brand-lift bg-brand-l" : "border-danger bg-pulse-l"
          }`}
        >
          {job.error === "" ? (
            <>
              <p>
                <strong className="font-semibold">
                  {job.total} départ{job.total > 1 ? "s" : ""} en préparation
                </strong>{" "}
                — {job.done} sur {job.total} écrit{job.done > 1 ? "s" : ""}. La file se remplit à
                mesure ; rechargez pour voir la suite. Rien n'est envoyé.
              </p>
              {/* Barre en SVG écrit à la main, comme tous les graphiques du
                  produit : aucune librairie, aucun JavaScript envoyé. */}
              <svg
                viewBox="0 0 100 3"
                width="100%"
                height="6"
                role="img"
                aria-label={`${job.done} sur ${job.total}`}
                className="mt-1.5"
              >
                <rect x="0" y="0" width="100" height="3" rx="1.5" className="fill-line" />
                <rect
                  x="0"
                  y="0"
                  width={job.total === 0 ? 0 : Math.min(100, (job.done / job.total) * 100)}
                  height="3"
                  rx="1.5"
                  className="fill-brand"
                />
              </svg>
            </>
          ) : (
            <p>
              <strong className="font-semibold">Composition interrompue</strong> après {job.done} sur{" "}
              {job.total} : {job.error} Les brouillons déjà écrits sont dans la file ; relancez la
              composition depuis la campagne pour les suivants.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
