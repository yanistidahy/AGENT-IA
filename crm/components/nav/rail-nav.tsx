"use client";

import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { Icon } from "@/components/ui/icon";
import { moneyShort } from "@/lib/format";
import { COUNCIL_TITLE, NAV_GROUPS, type NavEntry } from "@/lib/navigation";
import type { AgentProfile } from "@/lib/api/agents";
import { Portrait } from "@/components/agents/portrait";
import type { RailTotals } from "./rail";

/**
 * Le contenu du rail, en deux densités.
 *
 * **`compact` n'est pas un rail dégradé, c'est le même rail sans les mots** :
 * mêmes entrées, même ordre, mêmes pastilles — le libellé passe en `title` et
 * en `aria-label`. Replié ne veut pas dire caché : chaque destination reste à
 * un geste, ce qui est la condition posée pour avoir le droit de replier.
 *
 * Les deux densités sortent du même composant pour qu'une entrée ajoutée à
 * `NAV_GROUPS` apparaisse dans les deux sans seconde modification — la règle de
 * `lib/navigation.ts` depuis le correctif de la page d'accueil figée.
 */
export function RailNav({
  compact,
  pathname,
  totals,
  agents,
  dockedSlug,
  onDock,
}: {
  readonly compact: boolean;
  readonly pathname: string;
  readonly totals: RailTotals;
  readonly agents: readonly AgentProfile[];
  readonly dockedSlug: string | null;
  readonly onDock: (agent: AgentProfile) => void;
}) {
  return (
    <>
      <nav className={compact ? "flex flex-col items-center gap-1" : undefined}>
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className={compact ? "contents" : undefined}>
            {!compact && (
              <div className="px-3 pt-4 pb-1.5 text-rail-dim font-mono text-[9.5px] tracking-[0.14em] uppercase">
                {group.title}
              </div>
            )}
            {group.entries.map((entry) => (
              <NavItem
                key={entry.label}
                entry={entry}
                pathname={pathname}
                compact={compact}
                badge={entry.href === "/taches" ? (totals?.overdueCount ?? 0) : 0}
              />
            ))}
          </div>
        ))}

        {agents.length > 0 && (
          <div className={compact ? "contents" : undefined}>
            {!compact && (
              <div className="text-rail-dim px-3 pt-4 pb-1.5 font-mono text-[9.5px] tracking-[0.14em] uppercase">
                {COUNCIL_TITLE}
              </div>
            )}
            {agents.map((agent) => (
              <button
                key={agent.slug}
                type="button"
                onClick={() => onDock(agent)}
                aria-haspopup="dialog"
                aria-label={compact ? `${agent.name} — ${agent.role}` : undefined}
                title={compact ? `${agent.name} — ${agent.role}` : undefined}
                className={`flex items-center rounded-control text-left transition-colors ${
                  compact ? "size-11 justify-center" : "w-full gap-2.5 px-3 py-1.5"
                } ${
                  dockedSlug === agent.slug
                    ? "bg-rail-3 text-white"
                    : "hover:bg-rail-2 text-rail-text"
                }`}
              >
                <Portrait
                  agent={agent}
                  size="thumb"
                  className="size-7 shrink-0 rounded-full"
                  initialsClassName="text-[10px]"
                />
                {!compact && (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{agent.name}</span>
                    <span className="text-rail-dim block truncate text-[10.5px]">
                      {agent.role}
                    </span>
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* Les compteurs demandent des mots : en compact, ils cèdent la place. */}
      {!compact && (
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
      )}
    </>
  );
}

function NavItem({
  entry,
  pathname,
  badge,
  compact,
}: {
  entry: NavEntry;
  pathname: string;
  badge: number;
  compact: boolean;
}) {
  // 44 px de haut en compact : c'est la bande qu'on touche au pouce.
  const base = compact
    ? "relative flex size-11 items-center justify-center rounded-control transition-colors"
    : "relative flex w-full items-center gap-2.5 rounded-control px-[11px] py-2 text-left text-[13.5px] font-medium transition-colors";

  if (entry.href === null) {
    return (
      <span
        className={`${base} text-rail-dim cursor-default`}
        title={compact ? `${entry.label} — à venir` : "Livré dans un jalon à venir"}
      >
        <Icon name={entry.icon} size={compact ? 19 : 17} className="text-rail-dim shrink-0 opacity-70" />
        {!compact && <span>{entry.label}</span>}
        {!compact && (
          <span className="ml-auto font-mono text-[9px] tracking-wider uppercase">bientôt</span>
        )}
      </span>
    );
  }

  const active = entry.href === "/" ? pathname === "/" : pathname.startsWith(entry.href);

  return (
    <Link
      href={entry.href}
      aria-current={active ? "page" : undefined}
      aria-label={compact ? entry.label : undefined}
      title={compact ? entry.label : undefined}
      className={`${base} ${
        active ? "bg-rail-3 text-white" : "text-rail-text hover:bg-rail-2 hover:text-white"
      }`}
    >
      {active && (
        <span
          aria-hidden
          className="bg-brand-lift absolute top-1/2 left-0 h-4 w-[3px] -translate-y-1/2 rounded-r-full"
        />
      )}
      <Icon
        name={entry.icon}
        size={compact ? 19 : 17}
        className={`shrink-0 ${active ? "text-brand-lift" : "text-rail-dim"}`}
      />
      {!compact && <span>{entry.label}</span>}
      {badge > 0 &&
        (compact ? (
          // En compact, le nombre n'a pas la place : le point suffit à dire
          // « quelque chose t'attend », le nombre est à un tap.
          <span
            aria-hidden
            className="bg-pulse absolute top-1 right-1 size-2 rounded-full"
          />
        ) : (
          <span
            title={`${badge} tâche(s) en retard`}
            className="ml-auto rounded-full bg-pulse px-1.5 py-[1px] font-mono text-[10px] font-semibold text-white tabular-nums"
          >
            {badge}
          </span>
        ))}
    </Link>
  );
}
