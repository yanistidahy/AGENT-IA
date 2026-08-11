"use client";

import Link from "next/link";
import { usePersistedValue } from "@/lib/client/persisted";
import { STALE_AFTER_HOURS } from "@/lib/domain/snapshots";

/**
 * Le bandeau de sauvegarde en retard, une fois qu'on l'a lu.
 *
 * **Une alerte qu'on ne peut pas acquitter est une alerte qu'on apprend à ne
 * plus voir.** Un bloc rouge en haut de chaque visite finit par appartenir au
 * décor, et le jour où il compte vraiment il ne se distingue plus des jours où
 * il ne comptait pas.
 *
 * L'acquittement porte donc sur **l'épisode**, pas sur le bandeau : la clé
 * mémorisée est la date de la dernière sauvegarde réussie. Une nouvelle
 * sauvegarde qui réussit puis reprend du retard produit une clé différente, et
 * le bandeau revient plein. On tait un fait connu, on ne coupe pas l'alarme.
 */
export function BackupBanner({
  age,
  lastSuccessAt,
}: {
  /** Ancienneté déjà mise en français par le domaine. */
  age: string;
  /** ISO de la dernière réussite, ou `null`. Identifie l'épisode. */
  lastSuccessAt: string | null;
}) {
  const episode = lastSuccessAt ?? "aucune";
  const [acknowledged, loaded, acknowledge] = usePersistedValue("backup.ack");

  // Tant que le stockage n'est pas lu, le bandeau est **plein**. L'inverse —
  // ne rien rendre en attendant — rendrait l'alerte invisible côté serveur, et
  // donc absente pour qui n'exécute pas le script. Une alerte qui dépend du
  // navigateur pour apparaître n'est pas une alerte. Le seul sursaut possible
  // est une réduction, et seulement pour qui a déjà acquitté.
  if (loaded && acknowledged === episode) {
    return (
      <p className="mb-3 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted">
        <span aria-hidden className="size-1.5 rounded-full bg-pulse" />
        Sauvegarde en retard — dernière réussie {age}.{" "}
        <Link href="/reglages" className="underline hover:text-brand-d">
          Vérifier
        </Link>
      </p>
    );
  }

  return (
    <div className="mb-4 rounded-card border border-[#F0C9C2] bg-pulse-l px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-[13px] font-semibold">Sauvegarde en retard</p>
        <button
          type="button"
          onClick={() => acknowledge(episode)}
          className="rounded-control border border-line bg-surface px-2 py-1 text-[11px] font-semibold transition-colors hover:bg-surface-2"
        >
          J'ai vu
        </button>
      </div>
      <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
        Dernière sauvegarde réussie : {age}. Au-delà de {STALE_AFTER_HOURS} h sans instantané, une
        perte de base ne serait plus rattrapable.{" "}
        <Link href="/reglages" className="underline hover:text-brand-d">
          Vérifier les sauvegardes
        </Link>
      </p>
    </div>
  );
}
