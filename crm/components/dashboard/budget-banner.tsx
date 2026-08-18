import Link from "next/link";
import { formatCost, type BudgetState } from "@/lib/domain/model-pricing";

/**
 * Le bandeau de budget de l'API.
 *
 * Il n'apparaît qu'à partir de 80 % du plafond : un bandeau permanent
 * s'apprend et cesse d'être lu — c'est la leçon du bandeau de sauvegarde du
 * jalon 20. Il n'est pas acquittable, en revanche, et c'est délibéré : la
 * sauvegarde périmée est un incident dont on peut décider qu'il attendra
 * demain, un plafond franchi arrête la rédaction d'emails séance tenante.
 *
 * Composant serveur : il ne porte aucun état, seulement un chiffre déjà calculé
 * et un lien vers l'endroit où l'on agit.
 */
export function BudgetBanner({ budget }: { readonly budget: BudgetState }) {
  const over = budget.level === "over";
  const percent = Math.round(budget.ratio * 100);

  return (
    <p
      className={
        over
          ? "mb-4 rounded-control border border-[#F5D5CF] bg-pulse-l px-3.5 py-3 text-[12.5px] leading-relaxed text-[#B2311F]"
          : "mb-4 rounded-control border border-[#F0DFB8] bg-gold-l px-3.5 py-3 text-[12.5px] leading-relaxed text-[#9A6410]"
      }
    >
      <strong>
        {over
          ? "Plafond mensuel de l'API atteint."
          : `${percent} % du plafond mensuel de l'API consommés.`}
      </strong>{" "}
      {formatCost(budget.spentMicros)} dépensés sur {formatCost(budget.ceilingMicros)} ce
      mois-ci.{" "}
      {over
        ? "Les appels au modèle sont refusés avant d'être lancés — rédaction d'emails comprise."
        : "Au-delà, les appels seront refusés avant d'être lancés."}{" "}
      <Link className="font-semibold underline" href="/reglages">
        Réglages → Coûts de l'API
      </Link>
      .
    </p>
  );
}
