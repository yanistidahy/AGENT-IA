import Link from "next/link";

/**
 * Un graphique vide qui dit pourquoi, et quoi faire.
 *
 * Un cadre blanc est le pire des états : il ressemble à une panne, il ne dit
 * pas si la donnée manque ou si le calcul a échoué, et il n'indique aucune
 * sortie. Chaque graphique de `/rapports` passe donc par ici quand il n'a rien
 * à montrer, avec **sa** raison — jamais un message générique, qui serait la
 * même absence d'information sous une autre forme.
 */
export function EmptyChart({
  title,
  reason,
  action,
  href,
}: {
  title: string;
  /** Pourquoi ce graphique est vide, en une phrase. */
  reason: string;
  /** Le geste qui le remplira. Facultatif quand il n'y en a pas. */
  action?: string;
  href?: string;
}) {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface px-4 py-5">
      <p className="font-display text-[13.5px] font-semibold">{title}</p>
      <p className="mt-1 max-w-[52ch] text-[12.5px] leading-relaxed text-muted">
        {reason}
        {action !== undefined && (
          <>
            {" "}
            {href === undefined ? (
              action
            ) : (
              <Link href={href} className="underline hover:text-flux-d">
                {action}
              </Link>
            )}
          </>
        )}
      </p>
    </div>
  );
}
