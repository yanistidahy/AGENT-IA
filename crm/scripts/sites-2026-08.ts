/**
 * Adresses de sites réellement présentes dans « CRM AURA FLOW AI », relue le
 * 12 août 2026 en lecture seule (feuille modifiée le 7 août 2026).
 *
 * **Ce que la relecture a établi, et qui est le fait important de ce fichier :
 * la colonne `SITE` existe, mais elle ne contient presque jamais une adresse.**
 * Sur les 152 lignes de l'onglet « Liste de prospection », 71 portent une
 * valeur dans `SITE` — et **14 seulement** contiennent une URL ou un domaine.
 * Les 57 autres portent le *titre* de la page (« Vitamines et Compléments
 * alimentaires | Argalys Essentiels »), c'est-à-dire ce qu'affiche l'onglet du
 * navigateur, pas son adresse.
 *
 * Une quinzième adresse vient de l'onglet « Prospects chauds », colonne
 * `Boutique / URL`. Dans cet onglet-là, `SITE` désigne la **plateforme**
 * (« Shopify ») et non l'adresse — deux colonnes homonymes, deux sens.
 *
 * Les quatre autres onglets — « Suivi mensuel par canal », « Tableau de bord »,
 * « Clients signés & suivi », « Grille tarifaire » — ne contiennent aucune URL.
 *
 * Rien n'a donc été perdu à l'import : la colonne `SITE` a bien été versée dans
 * les Notes. Elle était simplement, à 80 %, autre chose qu'une adresse.
 */

export interface SheetSite {
  /** Ligne dans la feuille source. `C2` pour l'onglet « Prospects chauds ». */
  readonly row: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly company: string;
  /** L'adresse, telle qu'elle est écrite dans la feuille. */
  readonly url: string;
  /** La cellule complète, pour pouvoir contester le rapprochement. */
  readonly source: string;
}

/** Date de dernière modification de la feuille, telle que Drive la rapporte. */
export const SHEET_MODIFIED_AT = new Date("2026-08-07T17:34:43.494Z");

export const SHEET_SITES: readonly SheetSite[] = [
  {
    row: "97",
    firstName: "Hugo",
    lastName: "Fachin",
    email: "facchin@visimitra.com",
    company: "Cuure",
    url: "https://cuure.com/",
    source: "https://cuure.com/",
  },
  {
    row: "110",
    firstName: "Didier",
    lastName: "Arthaud",
    email: "didier.arthaud@66-30.com",
    company: "66-30",
    url: "https://66-30.com/fr/",
    source: "https://66-30.com/fr/",
  },
  {
    row: "111",
    firstName: "Giovanni",
    lastName: "amico",
    email: "giovanni.amico@copains-paris.com",
    company: "Copain paris",
    url: "copains-paris.com",
    source: "copains-paris.com",
  },
  {
    row: "112",
    firstName: "Angelik",
    lastName: "iffencker",
    email: "angelik.iffennecker@lesourcil.com",
    company: "Le sourcil",
    url: "lesourcil.com",
    source: "lesourcil.com",
  },
  {
    row: "116",
    firstName: "Mathilde",
    lastName: "gaymard",
    email: "mathilde@numorning.com",
    company: "Numorning",
    url: "numorning.com",
    source: "numorning.com",
  },
  {
    row: "125",
    firstName: "Wladimir",
    lastName: "topaloff",
    email: "wtopaloff@nubiance.fr",
    company: "Nubiance",
    url: "www.nubiance.fr",
    source: "www.nubiance.fr",
  },
  {
    row: "132",
    firstName: "Saskia",
    lastName: "slama",
    email: "saskia@pomad.paris",
    company: "Pomad",
    url: "pomad.paris",
    source: "Pomad.Paris - la marque naturelle pour l'eczéma & le psoriasis – pomad.paris",
  },
  {
    row: "137",
    firstName: "Gina ceku",
    lastName: "",
    email: "gina@carel.fr",
    company: "Carel paris",
    url: "https://www.carel-paris.com/",
    source: "https://www.carel-paris.com/",
  },
  {
    row: "138",
    firstName: "Estelle xie",
    lastName: "",
    email: "exie@inesdelafressange.fr",
    company: "Ines de la fressange",
    url: "https://inesdelafressange.fr/",
    source: "https://inesdelafressange.fr/",
  },
  {
    row: "139",
    firstName: "Celine pubert",
    lastName: "",
    email: "cpubert@audencia.com",
    company: "PAUL KA",
    url: "https://www.pauleka.com/",
    source: "https://www.pauleka.com/",
  },
  {
    row: "140",
    firstName: "Margaux",
    lastName: "",
    email: "margaux@nebuleusebijoux.com",
    company: "Nébuleuse bijoux",
    url: "https://nebuleusebijoux.com/",
    source: "https://nebuleusebijoux.com/",
  },
  {
    row: "141",
    firstName: "Hanna",
    lastName: "",
    email: "hanna@march-lab.com",
    company: "Marchlab",
    url: "https://march-lab.com/",
    source: "https://march-lab.com/",
  },
  {
    row: "142",
    firstName: "Rossana boudet",
    lastName: "",
    email: "r.boudet@antikbatik.fr",
    company: "Antik batik",
    url: "https://www.antikbatik.com/",
    source: "https://www.antikbatik.com/",
  },
  {
    row: "152",
    firstName: "Mickael",
    lastName: "fradin",
    email: "mike@nateev.fr",
    company: "Agence nateev",
    url: "nateev.fr",
    source: "L'agence web créative ! Shopify Partner & E-commerce - nateev.fr",
  },
  {
    // Onglet « Prospects chauds », colonne `Boutique / URL`. La colonne `SITE`
    // de cet onglet dit « Shopify » — la plateforme, pas l'adresse.
    row: "C2",
    firstName: "Aurélie",
    lastName: "",
    email: "",
    company: "",
    url: "https://www.odishayi.com",
    source: "Boutique / URL : https://www.odishayi.com",
  },
];
