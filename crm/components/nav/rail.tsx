"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icon";
import { moneyShort } from "@/lib/format";

/**
 * Rail de navigation, repris du prototype.
 *
 * Les entrées non encore livrées restent visibles mais inertes, avec la mention
 * « à venir » : la structure du produit est lisible dès maintenant, sans lien
 * mort qui mène à une 404.
 */

interface NavEntry {
  readonly label: string;
  readonly href: string | null;
  readonly icon: IconName;
}

interface NavGroup {
  readonly title: string;
  readonly entries: readonly NavEntry[];
}

const GROUPS: readonly NavGroup[] = [
  {
    title: "Pilotage",
    entries: [
      { label: "Accueil", href: "/", icon: "dash" },
      { label: "Pipeline", href: "/pipeline", icon: "pipe" },
      { label: "Tâches", href: null, icon: "task" },
    ],
  },
  {
    title: "Données",
    entries: [
      { label: "Affaires", href: "/affaires", icon: "deal" },
      { label: "Contacts", href: "/contacts", icon: "people" },
      { label: "Sociétés", href: "/societes", icon: "build" },
    ],
  },
  {
    title: "Analyse",
    entries: [
      { label: "Rapports", href: null, icon: "chart" },
      { label: "Réglages", href: null, icon: "gear" },
    ],
  },
  {
    title: "Conseil",
    entries: [{ label: "Alfred & Associés", href: "/conseil", icon: "bot" }],
  },
];

interface RailProps {
  readonly pipelineValue: number;
  readonly wonCount: number;
}

export function Rail({ pipelineValue, wonCount }: RailProps) {
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
        {GROUPS.map((group) => (
          <div key={group.title}>
            <div className="px-3 pt-4 pb-1.5 font-mono text-[9.5px] tracking-[0.14em] text-[#4E6A64] uppercase">
              {group.title}
            </div>
            {group.entries.map((entry) => (
              <NavItem key={entry.label} entry={entry} pathname={pathname} />
            ))}
          </div>
        ))}
      </nav>

      <div className="mt-auto border-t border-[#1B2C29] px-3 pt-3.5 text-[11.5px] leading-relaxed text-[#5E7A74]">
        <b className="font-mono text-[11px] text-[#B7CCC7]">{moneyShort(pipelineValue)}</b> en
        pipeline
        <br />
        {wonCount} affaires gagnées
      </div>
    </aside>
  );
}

function NavItem({ entry, pathname }: { entry: NavEntry; pathname: string }) {
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
    </Link>
  );
}
