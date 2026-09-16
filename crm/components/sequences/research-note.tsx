/**
 * Ce qu'Alex a lu avant d'écrire, sur la carte du départ.
 *
 * **Pour qu'une erreur se voie avant l'envoi, pas après.** Un brouillon
 * documenté et un brouillon générique se ressemblent : les deux sont bien
 * écrits, et seul le premier affirme quelque chose sur le prospect. Sans cette
 * note, la seule façon de vérifier une affirmation serait d'aller voir le site
 * soi-même — c'est-à-dire de refaire le travail qu'on vient de payer.
 *
 * Trois états, et le second est celui qui compte :
 *
 * - **lu** : le résumé d'une ligne, et les pages, cliquables ;
 * - **rien à lire** : la cause est nommée, et l'on sait que le message est
 *   générique **par décision** et non par paresse du modèle ;
 * - **une affirmation non sourcée** : signalée en rouge, avec le mot en cause.
 */

export interface ResearchNoteData {
  readonly usable: boolean;
  readonly gap: string;
  readonly summary: string;
  readonly sources: readonly { readonly url: string; readonly title: string }[];
}

export function ResearchNote({
  research,
  ungrounded,
}: {
  readonly research: ResearchNoteData | null;
  readonly ungrounded: string | null;
}) {
  return (
    <div className="mt-1 w-full text-[11.5px]">
      {research === null ? (
        <p className="text-muted">
          Recherche : aucune société rattachée à cette fiche, donc rien à lire. Message générique.
        </p>
      ) : research.usable ? (
        <>
          <p className="text-muted">
            <span className="font-semibold text-ink">Alex a lu :</span> {research.summary}
          </p>
          {research.sources.length > 0 && (
            <p className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-muted">
              <span>Sources :</span>
              {research.sources.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-d underline"
                  title={source.url}
                >
                  {source.title === "" ? source.url : source.title}
                </a>
              ))}
            </p>
          )}
        </>
      ) : (
        <p className="text-muted">
          <span className="font-semibold text-ink">Aucune recherche :</span>{" "}
          {research.gap === "" ? "rien d'exploitable n'a été lu" : research.gap}. Le message est
          générique, et n'affirme donc rien sur cette entreprise.
        </p>
      )}

      {ungrounded !== null && (
        <p className="mt-1 rounded-control border border-danger px-2 py-1 font-semibold text-danger">
          {ungrounded}
        </p>
      )}
    </div>
  );
}
