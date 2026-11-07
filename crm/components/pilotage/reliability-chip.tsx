import { RELIABILITY_LABELS, type Reliability } from "@/lib/domain/size-buckets";

/**
 * **La puce de fiabilité, et le `n` à côté de chaque taux.**
 *
 * Un seul composant pour les quatre onglets. La raison n'est pas l'économie :
 * c'est que « 12 % » affiché pareil sur neuf personnes et sur trois cents est la
 * façon la plus courante de tromper quelqu'un avec un chiffre exact, et une
 * règle recopiée écran par écran finit par manquer sur l'écran qui compte.
 *
 * **Jamais la couleur seule.** Chaque état porte son mot — « à ne pas
 * interpréter », « échantillon faible », « fiable » — et l'état illisible porte
 * en plus des hachures. Un daltonien ne distingue pas l'ambre du vert.
 */

const STYLES: Record<Reliability, string> = {
  unusable: "border-line bg-line-2 text-closed",
  weak: "border-gold/40 bg-gold-l text-gold-d",
  solid: "border-win/30 bg-win-l text-win-d",
};

export function ReliabilityChip({
  n,
  reliability,
}: {
  readonly n: number;
  readonly reliability: Reliability;
}) {
  return (
    <span
      data-reliability={reliability}
      data-n={n}
      title={`${n} personne${n > 1 ? "s" : ""} derrière ce taux`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${STYLES[reliability]}`}
    >
      {reliability === "unusable" ? <Hatch /> : null}
      {RELIABILITY_LABELS[reliability]}
    </span>
  );
}

/**
 * Les hachures d'un échantillon trop petit : lisibles en noir et blanc.
 *
 * En dégradé CSS et non en `<pattern>` SVG, et c'est une correction et non un
 * goût : un motif SVG a besoin d'un `id`, la puce se répète des dizaines de
 * fois sur un même écran, et des identifiants dupliqués font un document
 * invalide où `url(#…)` résout toujours vers le premier. Le dégradé n'a pas
 * d'identité.
 */
function Hatch() {
  return (
    <span
      aria-hidden="true"
      data-hatch
      className="inline-block size-2.5 shrink-0 rounded-[2px] opacity-70"
      style={{
        backgroundImage:
          "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 4px)",
      }}
    />
  );
}

/**
 * **Le `n` écrit en toutes lettres : « 4 sur 37 personnes ».**
 *
 * À côté du taux, pas à la place : le taux se compare, le `n` dit s'il a le
 * droit de l'être. Les deux ensemble sont la seule forme honnête, et c'est la
 * phrase que le prototype met sous chaque grand pourcentage.
 */
export function SampleLine({
  part,
  whole,
}: {
  readonly part: number;
  readonly whole: number;
}) {
  return (
    <span data-sample className="text-[12px] text-muted">
      {part} sur {whole} personne{whole > 1 ? "s" : ""}
    </span>
  );
}
