import type { UnmatchedTitle } from "@/lib/domain/role-angles";

/**
 * Les fonctions qu'aucun rôle ne reconnaît.
 *
 * **C'est la moitié utile du panneau.** Un appariement qui échoue en silence
 * fait retomber Alex sur l'angle générique sans que personne l'apprenne : les
 * messages partent, ils sont corrects, et ils sont tièdes. La liste rend cet
 * échec visible et chiffré — chaque ligne est une étiquette à écrire, triée
 * par le nombre de personnes qu'elle débloque.
 *
 * Les fiches **sans fonction** sont comptées à part : elles n'appellent aucune
 * étiquette, c'est une donnée à saisir. Les mêler ferait chercher un réglage
 * pour une information absente.
 */
export function UnmatchedTitles({
  unmatched,
  withoutTitle,
}: {
  readonly unmatched: readonly UnmatchedTitle[];
  readonly withoutTitle: number;
}) {
  return (
    <div className="mt-4 border-t border-line-2 pt-3">
      <h3 className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
        Fonctions non reconnues
      </h3>

      {unmatched.length === 0 ? (
        <p className="mt-1.5 text-[12px] text-muted">
          Toutes les fonctions renseignées tombent sur un rôle.
        </p>
      ) : (
        <>
          <p className="mt-1.5 text-[12px] text-muted">
            Ces intitulés n'appartiennent à aucun rôle : leurs fiches reçoivent l'angle
            générique. Ajoutez l'intitulé aux étiquettes du rôle qui convient.
          </p>
          <ul className="mt-2 space-y-1">
            {unmatched.map((row) => (
              <li key={row.title} className="flex items-baseline gap-2 text-[13px]">
                <span className="font-mono text-[12px]">{row.title}</span>
                <span className="text-[12px] text-muted">
                  {row.contacts} fiche{row.contacts > 1 ? "s" : ""}
                </span>
                {row.reason === "ambiguous" && (
                  <span className="text-[12px] text-warn-d">
                    correspond à plusieurs rôles — préciser une étiquette
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {withoutTitle > 0 && (
        <p className="mt-2 text-[12px] text-muted">
          {withoutTitle} fiche{withoutTitle > 1 ? "s" : ""} sans fonction renseignée — rien à
          régler ici, c'est une donnée à saisir sur la fiche.
        </p>
      )}
    </div>
  );
}
