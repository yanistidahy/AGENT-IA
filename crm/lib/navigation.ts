import type { IconName } from "@/components/ui/icon";

/**
 * Structure de navigation du CRM — source unique.
 *
 * Le rail *et* les cartes de la page d'accueil lisent cette liste. Avant, chacun
 * portait la sienne : livrer un écran demandait deux modifications, et en oublier
 * une laissait l'accueil parler d'un produit qui n'existait plus.
 *
 * `href: null` signale un écran non encore livré : il reste visible pour que la
 * structure du produit soit lisible, mais inerte, sans lien mort vers une 404.
 * Rien ne peut deviner qu'un écran est livré — c'est un jugement, pas un fait
 * mesurable. Mais il n'y a plus qu'un seul endroit où le déclarer.
 */

export interface NavEntry {
  readonly label: string;
  readonly href: string | null;
  readonly icon: IconName;
  /** Phrase affichée sur la carte d'accueil. */
  readonly desc: string;
}

export interface NavGroup {
  readonly title: string;
  readonly entries: readonly NavEntry[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    title: "Pilotage",
    entries: [
      {
        label: "Accueil",
        href: "/",
        icon: "dash",
        desc: "État de la base et raccourcis.",
      },
      {
        label: "Pipeline",
        href: "/pipeline",
        icon: "pipe",
        desc: "Kanban glisser-déposer, fluxbar en tête.",
      },
      {
        label: "Tâches",
        href: "/taches",
        icon: "task",
        desc: "Relances et échéances, groupées par urgence.",
      },
    ],
  },
  {
    title: "Données",
    entries: [
      {
        label: "Affaires",
        href: "/affaires",
        icon: "deal",
        desc: "Liste filtrable, tri, fiche détaillée.",
      },
      {
        label: "Contacts",
        href: "/contacts",
        icon: "people",
        desc: "Recherche, cycle de vie, import et export CSV.",
      },
      {
        label: "Sociétés",
        href: "/societes",
        icon: "build",
        desc: "Cartes, pipeline ouvert et chiffre d'affaires signé.",
      },
    ],
  },
  {
    title: "Analyse",
    entries: [
      {
        label: "Rapports",
        href: null,
        icon: "chart",
        desc: "Entonnoir, prévisions, performance par propriétaire.",
      },
      {
        label: "Réglages",
        href: "/reglages",
        icon: "gear",
        desc: "Étapes, listes, seuils d'alerte, sauvegarde.",
      },
    ],
  },
  {
    title: "Conseil",
    entries: [
      {
        label: "Alfred & Associés",
        href: "/conseil",
        icon: "bot",
        desc: "Huit agents qui lisent le CRM et proposent des actions.",
      },
    ],
  },
];

/** Écrans livrés, hors accueil : ce que les cartes de la page d'accueil proposent. */
export function shippedEntries(): NavEntry[] {
  return NAV_GROUPS.flatMap((group) => group.entries).filter(
    (entry) => entry.href !== null && entry.href !== "/",
  );
}
