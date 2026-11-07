import Link from "next/link";
import { TABS, tabHref, type Params, type TabHref } from "@/lib/domain/board-links";

/**
 * **Les quatre onglets, et les filtres qui les traversent.**
 *
 * Composant serveur : ce sont des liens, donc le navigateur fait le travail et
 * aucun JavaScript n'est envoyé pour changer d'onglet. Chaque lien reconduit les
 * filtres partagés (`tabHref`) et laisse derrière lui les réglages propres à
 * l'onglet quitté — une granularité de graphique n'a rien à décider du tri d'un
 * tableau de campagnes.
 *
 * `aria-current="page"` plutôt qu'une classe seule : l'onglet actif doit se dire
 * au lecteur d'écran, et pas seulement se voir.
 */
export function BoardTabs({ params, active }: { readonly params: Params; readonly active: TabHref }) {
  return (
    <nav aria-label="Vues du pilotage" data-board-tabs className="mb-4 border-b border-line">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {TABS.map((tab) => {
          const current = tab.href === active;
          return (
            <li key={tab.href}>
              <Link
                href={tabHref(params, tab.href)}
                aria-current={current ? "page" : undefined}
                data-board-tab={tab.href}
                data-active={current ? "1" : "0"}
                className={`inline-block whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ${
                  current
                    ? "border-brand text-brand-d"
                    : "border-transparent text-closed hover:border-line hover:text-ink"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
