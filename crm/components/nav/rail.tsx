"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
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
    <aside className="flex w-[236px] shrink-0 flex-col gap-0.5 overflow-y-auto bg-ink px-3 py-[18px] text-[#CFDEDA]">
      <div className="flex items-center gap-2.5 px-2.5 pt-1.5 pb-5">
        <span className="size-[30px] shrink-0 rounded-[9px] bg-gradient-to-br from-flux to-violet" />
        <span className="font-display text-[15px] leading-tight font-bold tracking-tight text-white">
          AuraFLOW
          <span className="mt-0.5 block font-mono text-[9.5px] font-normal tracking-[0.14em] text-flux uppercase">
            CRM
          </span>
        </span>
      </div>

      <nav>
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="px-3 pt-4 pb-1.5 font-mono text-[9.5px] tracking-[0.14em] text-[#4E6A64] uppercase">
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

      <div className="mt-auto border-t border-[#1B2C29] px-3 pt-3.5 text-[11.5px] leading-relaxed text-[#5E7A74]">
        {totals === null ? (
          <span className="text-[#C98B7F]">
            Compteurs indisponibles
            <br />
            la base n'a pas répondu
          </span>
        ) : (
          <>
            <b className="font-mono text-[11px] text-[#B7CCC7]">
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
    "flex w-full items-center gap-2.5 rounded-control px-[11px] py-2 text-left text-[13.5px] font-medium transition-colors";

  if (entry.href === null) {
    return (
      <span
        className={`${base} cursor-default text-[#54706A]`}
        title="Livré dans un jalon à venir"
      >
        <Icon name={entry.icon} size={17} className="shrink-0 text-[#3F5854]" />
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
        active ? "bg-ink-3 text-white" : "text-[#B7CCC7] hover:bg-ink-2 hover:text-white"
      }`}
    >
      <Icon
        name={entry.icon}
        size={17}
        className={`shrink-0 ${active ? "text-flux" : "text-[#7E9994]"}`}
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
