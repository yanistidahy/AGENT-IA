import Link from "next/link";
import {
  buildFunnel,
  neverApproached,
  NEVER_APPROACHED_HREF,
  type FunnelInput,
} from "@/lib/domain/funnel";

/**
 * L'entonnoir de prospection — l'ancre visuelle de l'écran.
 *
 * SVG écrit à la main, sans bibliothèque. La forme est volontairement
 * horizontale : les bandes se lisent de gauche à droite comme la phrase qu'elles
 * remplacent, et les taux de passage s'intercalent là où le regard les cherche,
 * entre deux bandes.
 *
 * **Chaque bande est un lien.** Un graphique qui montre soixante-deux fiches
 * jamais approchées sans permettre de les ouvrir transforme un constat en
 * reproche. La largeur ne descend jamais à zéro (voir `buildFunnel`) : « 0
 * affaire » est précisément la bande qu'il faut voir.
 */
const WIDTH = 680;
const BAND = 46;
const GAP = 12;

/**
 * Le dégradé des bandes, du haut vers le bas de l'entonnoir.
 *
 * Il s'éclaircit à mesure que les prospects se raréfient, mais **par teintes
 * opaques, pas par opacité**. L'ancienne version réduisait l'alpha jusqu'à
 * 0.44 : la dernière bande finissait à un lavande pâle sur lequel le libellé
 * n'était plus lisible ni en blanc ni en foncé. Chacune de ces cinq teintes
 * tient au moins 4.6:1 avec du texte blanc — la plus claire, la plus juste,
 * est mesurée à 4.65:1.
 */
const SHADES = ["#3a2fc7", "#443ad8", "#4b3fe4", "#5c51e7", "#6c61ea"] as const;

function shade(index: number): string {
  return SHADES[Math.min(index, SHADES.length - 1)] ?? "#4b3fe4";
}

export function ProspectingFunnel({ data }: { data: FunnelInput }) {
  const bands = buildFunnel(data);
  const never = neverApproached(data);
  const height = bands.length * (BAND + GAP);

  return (
    <div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          // La largeur plancher ne vaut qu'au-dessus de `lg` : sur téléphone,
          // le SVG se met à l'échelle du cadre (viewBox) au lieu de défiler.
          className="h-auto w-full lg:min-w-[420px]"
          role="img"
          aria-label={bands.map((band) => `${band.value} ${band.label}`).join(", puis ")}
        >
          {bands.map((band, index) => {
            const y = index * (BAND + GAP);
            const width = Math.max(band.share * WIDTH, 96);
            const x = (WIDTH - width) / 2;
            const empty = band.value === 0;

            return (
              <g key={band.key}>
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={BAND}
                  rx={7}
                  fill={empty ? "var(--color-brand-l)" : shade(index)}
                />
                <text
                  x={WIDTH / 2}
                  y={y + BAND / 2 + 5}
                  textAnchor="middle"
                  className="font-display text-[15px] font-semibold"
                  fill={empty ? "var(--color-ink)" : "#fff"}
                >
                  {band.value} {band.label}
                </text>
                {band.rate !== null && (
                  // Alignés à droite du cadre plutôt que collés à la bande :
                  // une bande pleine largeur poussait son taux hors de l'image,
                  // et une colonne régulière se lit de toute façon mieux qu'un
                  // chiffre qui se déplace d'une ligne à l'autre.
                  <text
                    x={WIDTH - 4}
                    y={y - GAP / 2 + 4}
                    textAnchor="end"
                    className="font-mono text-[10px]"
                    fill="var(--color-muted)"
                  >
                    {band.rate} %
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Les liens vivent hors du SVG : un `<a>` dans un graphique est atteignable
          à la souris mais se navigue mal au clavier, et son libellé accessible
          dépend du rendu du texte. Ici ce sont de vrais liens, alignés sous le
          dessin, qui disent chacun où ils mènent. */}
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {bands.map((band) => (
          <li key={band.key}>
            <Link
              href={band.href}
              className="inline-flex items-center gap-1 rounded-control border border-line bg-surface px-2 py-1 text-[11.5px] transition-colors hover:bg-surface-2"
            >
              <b className="font-mono font-semibold tabular-nums">{band.value}</b> {band.label}
            </Link>
          </li>
        ))}
      </ul>

      {never > 0 && (
        <p className="mt-2 rounded-control border border-[#F0DFB8] bg-gold-l px-3 py-2 text-[12.5px] leading-relaxed text-[#9A6410]">
          <b className="font-semibold">{never} contacts n'ont jamais été approchés.</b> C'est la
          fuite du haut de l'entonnoir : rien de ce qui suit ne peut grandir tant qu'ils y restent.{" "}
          <Link href={NEVER_APPROACHED_HREF} className="underline hover:text-brand-d">
            Les ouvrir
          </Link>
        </p>
      )}

      {data.deals === 0 && data.answered > 0 && (
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
          {data.answered} personne(s) ont répondu et aucune affaire n'existe encore : c'est là que
          se perd la conversion, pas plus haut.
        </p>
      )}
    </div>
  );
}
