"use client";

import { instagramLabel, instagramUrl } from "@/lib/domain/instagram";
import { ExternalLink } from "@/components/ui/external-link";
import { ACTIVITY_LABELS } from "@/lib/domain/types";
import { formatDate } from "@/lib/format";
import type { ContactColumn } from "./contact-table-columns";

/**
 * Les colonnes facultatives — celles qui répondent à « combien ai-je essayé ? ».
 *
 * Elles vivent à part pour deux raisons. La limite de 250 lignes, d'abord ; et
 * la distinction qu'elles portent, ensuite : ce sont **les colonnes qu'on
 * ajoute**, jamais affichées par défaut. Les mêler aux six du quotidien
 * effacerait ce partage dans le code alors qu'il gouverne l'écran.
 *
 * Aucune n'est triable ni filtrable : ce sont des agrégats calculés à la
 * lecture, pas des colonnes de la table `contacts`. Promettre un tri qui ne
 * trierait rien serait pire que ne rien promettre.
 */
const MUTED = <span className="text-muted">—</span>;

export const EXTRA_COLUMNS: readonly ContactColumn[] = [
  /**
   * Les deux seules colonnes de ce fichier qui **se trient**, et c'est voulu.
   *
   * Elles ne sont pas des agrégats calculés à la lecture comme leurs voisines :
   * `emailCount` et `lastEmailAt` sont écrits sur la fiche dans la transaction
   * d'envoi. Ce sont donc de vraies colonnes de la table `contacts`, que
   * PostgreSQL sait ordonner — d'où le tri promis et tenu.
   */
  {
    key: "emailCount",
    label: "Emails envoyés",
    sort: "emailCount",
    filterKey: null,
    cell: (contact) =>
      contact.emailCount === 0 ? (
        MUTED
      ) : (
        <span className="font-mono tabular-nums">{contact.emailCount}</span>
      ),
  },
  {
    key: "lastEmailAt",
    label: "Dernier email",
    sort: "lastEmailAt",
    filterKey: null,
    cell: (contact) =>
      contact.lastEmailAt === null ? MUTED : <span>{formatDate(contact.lastEmailAt)}</span>,
  },
  {
    key: "attempts",
    label: "Tentatives",
    sort: null,
    filterKey: null,
    // « 3 · 0 réponse » : le second nombre est celui qui tranche entre insister
    // et abandonner. Le premier seul récompenserait l'acharnement.
    cell: (contact) =>
      contact.attempts === 0 ? (
        MUTED
      ) : (
        <span className="font-mono tabular-nums">
          {contact.attempts} ·{" "}
          <span className={contact.unanswered === contact.attempts ? "text-[#B2311F]" : ""}>
            {contact.attempts - contact.unanswered} rép.
          </span>
        </span>
      ),
  },
  {
    key: "lastChannel",
    label: "Dernier canal",
    sort: null,
    filterKey: null,
    cell: (contact) =>
      contact.lastChannel === null ? MUTED : ACTIVITY_LABELS[contact.lastChannel],
  },
  {
    key: "companySize",
    label: "Taille",
    sort: null,
    filterKey: null,
    cell: (contact) => contact.companySize || "—",
  },
  {
    key: "companyIndustry",
    label: "Secteur",
    sort: null,
    filterKey: null,
    cell: (contact) => contact.companyIndustry || "—",
  },
  {
    key: "ageDays",
    label: "Ancienneté",
    sort: "createdAt",
    filterKey: null,
    // En jours et non en date : « 94 j » dit tout de suite qu'une fiche dort
    // depuis trois mois, là où « 08/05/2026 » demande un calcul.
    cell: (contact) => <span className="font-mono tabular-nums">{contact.ageDays} j</span>,
  },
  {
    key: "website",
    label: "Site",
    sort: null,
    filterKey: null,
    cell: (contact) => <ExternalLink value={contact.website} />,
  },
  {
    key: "instagram",
    label: "Instagram",
    sort: null,
    filterKey: null,
    // Le compte, pas le fait de l'avoir contacté : les deux colonnes se
    // suivent pour que l'écart soit visible d'un coup d'œil.
    cell: (contact) => {
      const href = instagramUrl(contact.instagram);
      if (href === null) return <span className="text-muted">—</span>;
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="text-brand-d hover:underline"
        >
          {instagramLabel(contact.instagram)}
        </a>
      );
    },
  },
  {
    key: "dm",
    label: "DM",
    sort: null,
    filterKey: null,
    // « Pas encore » et non « — » : l'absence de DM est un état de la
    // prospection, pas une donnée manquante, et c'est une file de travail.
    cell: (contact) =>
      contact.dmAt === null ? (
        <span className="text-muted">Pas encore</span>
      ) : (
        <span className="font-mono tabular-nums text-win-d">
          envoyé {formatDate(contact.dmAt)}
        </span>
      ),
  },
];
