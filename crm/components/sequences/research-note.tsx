import type { ResearchCard } from "@/lib/domain/research";

/**
 * Ce qu'Alex a lu avant d'écrire, sur la carte du départ **et** dans le tiroir
 * de contact.
 *
 * **Pour qu'une erreur se voie avant l'envoi, pas après.** Un brouillon
 * documenté et un brouillon générique se ressemblent : les deux sont bien
 * écrits, et seul le premier affirme quelque chose sur le prospect. Sans cette
 * note, la seule façon de vérifier une affirmation serait d'aller voir le site
 * soi-même, c'est-à-dire de refaire le travail qu'on vient de payer.
 *
 * ### Pourquoi trois états, et pourquoi ils ne se ressemblent pas
 *
 * Jusqu'au jalon 74, une recherche cassée et une société sans site rendaient la
 * même phrase tiède. On cherchait donc la donnée manquante pendant que c'était
 * la chaîne qui était en panne, et cela a coûté une journée. Les trois états
 * sont maintenant visuellement distincts, et le deuxième porte **la raison
 * exacte** :
 *
 * - **rien à lire** (gris) : aucune société, ou aucun site connu sur la fiche.
 *   C'est la fiche qu'il faut compléter, et le message est générique **par
 *   décision** ;
 * - **échec** (rouge) : la recherche a été tentée et n'a pas abouti. C'est nous
 *   qu'il faut corriger ;
 * - **lue** : le nombre de sources, le résumé, et les pages cliquables.
 *
 * Le composant est **partagé par les deux surfaces** : deux rendus de la même
 * recherche finiraient par ne plus dire la même chose, et c'est toujours le
 * second qu'on oublie de corriger (jalons 55, 66 et 67).
 */
export function ResearchNote({
  research,
  ungrounded,
}: {
  readonly research: ResearchCard;
  readonly ungrounded: string | null;
}) {
  return (
    <div className="mt-1 w-full text-[11.5px]">
      {research.state === "read" ? (
        <>
          <p className="text-muted">
            <span className="font-semibold text-ink">{research.headline} :</span>{" "}
            {research.detail === "" ? "aucun résumé rendu" : research.detail}
          </p>
          {/*
            **D'où venait l'adresse lue**, et non seulement laquelle. Une cible
            déduite d'une adresse électronique se diagnostique autrement qu'un
            champ saisi : si la lecture dérape, c'est la première chose à savoir
            (jalon 75).
          */}
          {research.target !== "" && (
            <p className="mt-0.5 text-muted">Site lu : {research.target}</p>
          )}
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
      ) : research.state === "failed" ? (
        <p className="rounded-control border border-danger px-2 py-1 text-danger">
          <span className="font-semibold">{research.headline} :</span> {research.detail}. Le message
          est générique, et c'est un défaut à corriger, pas une fiche à compléter.
          {research.target === "" ? "" : ` Site visé : ${research.target}.`}
        </p>
      ) : (
        <p className="text-muted">
          <span className="font-semibold text-ink">{research.headline}.</span> Ni site sur la fiche,
          ni domaine sur la société, ni adresse électronique professionnelle à en déduire. Le
          message est générique, et n'affirme donc rien sur cette entreprise.
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
