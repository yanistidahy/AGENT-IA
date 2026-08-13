"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { Wordmark } from "@/components/brand/logo";
import { Icon } from "@/components/ui/icon";
import { moneyShort } from "@/lib/format";
import { NAV_GROUPS, type NavEntry } from "@/lib/navigation";

/**
 * Rail de navigation, repris du prototype.
 *
 * La liste des entrées vit dans `lib/navigation.ts`, partagée avec les cartes de
 * la page d'accueil : livrer un écran ne demande qu'une seule modification.
 */
/**
 * Compteurs du pied de rail. `null` signifie « la requête a échoué », ce qui
 * n'est pas la même chose que zéro : le rail le dit au lieu d'afficher 0 €.
 */
export type RailTotals = {
  readonly pipelineValue: number;
  readonly wonCount: number;
  /** Tâches en retard — pastille sur l'entrée Tâches. */
  readonly overdueCount: number;
} | null;

export function Rail({ totals }: { totals: RailTotals }) {
  const pathname = usePathname();

  return (
    <aside className="bg-rail text-rail-text flex w-[236px] shrink-0 flex-col gap-0.5 overflow-y-auto px-3 py-[18px]">
      <div className="px-2.5 pt-1.5 pb-5">
        <Wordmark size={34} />
      </div>

      <nav>
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="px-3 pt-4 pb-1.5 text-rail-dim font-mono text-[9.5px] tracking-[0.14em] uppercase">
              {group.title}
            </div>
            {group.entries.map((entry) => (
              <NavItem
                key={entry.label}
                entry={entry}
                pathname={pathname}
                badge={entry.href === "/taches" ? (totals?.overdueCount ?? 0) : 0}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="text-rail-dim border-rail-3 mt-auto border-t px-3 pt-3.5 text-[11.5px] leading-relaxed">
        {totals === null ? (
          <span className="text-[#FFB3A6]">
            Compteurs indisponibles
            <br />
            la base n'a pas répondu
          </span>
        ) : (
          <>
            <b className="text-rail-text font-mono text-[11px]">
              {moneyShort(totals.pipelineValue)}
            </b>{" "}
            en pipeline
            <br />
            {totals.wonCount} affaires gagnées
          </>
        )}
        <LogoutButton />
      </div>
    </aside>
  );
}

function NavItem({
  entry,
  pathname,
  badge,
}: {
  entry: NavEntry;
  pathname: string;
  badge: number;
}) {
  const base =
    "relative flex w-full items-center gap-2.5 rounded-control px-[11px] py-2 text-left text-[13.5px] font-medium transition-colors";

  if (entry.href === null) {
    return (
      <span
        className={`${base} text-rail-dim cursor-default`}
        title="Livré dans un jalon à venir"
      >
        <Icon name={entry.icon} size={17} className="text-rail-dim shrink-0 opacity-70" />
        <span>{entry.label}</span>
        <span className="ml-auto font-mono text-[9px] tracking-wider uppercase">bientôt</span>
      </span>
    );
  }

  const active = entry.href === "/" ? pathname === "/" : pathname.startsWith(entry.href);

  return (
    <Link
      href={entry.href}
      aria-current={active ? "page" : undefined}
      className={`${base} ${
        active ? "bg-rail-3 text-white" : "text-rail-text hover:bg-rail-2 hover:text-white"
      }`}
    >
      {/*
        L'entrée active se reconnaît à trois signaux, pas un seul : le fond plus
        clair, le libellé en blanc, et ce repère. Le fond seul ne suffit pas —
        deux bleus profonds voisins se distinguent mal, et pas du tout pour qui
        règle son écran bas.

        Le bleu-violet plein n'atteint que 2.1:1 sur ce fond : c'est `brand-lift`
        qui porte la marque partout où le fond est sombre.
      */}
      {active && (
        <span
          aria-hidden
          className="bg-brand-lift absolute top-1/2 left-0 h-4 w-[3px] -translate-y-1/2 rounded-r-full"
        />
      )}
      <Icon
        name={entry.icon}
        size={17}
        className={`shrink-0 ${active ? "text-brand-lift" : "text-rail-dim"}`}
      />
      <span>{entry.label}</span>
      {badge > 0 && (
        <span
          title={`${badge} tâche(s) en retard`}
          className="ml-auto rounded-full bg-pulse px-1.5 py-[1px] font-mono text-[10px] font-semibold text-white tabular-nums"
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
