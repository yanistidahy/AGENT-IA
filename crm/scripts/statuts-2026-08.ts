/**
 * Statuts de contact issus de « CRM AURA FLOW AI », onglet « Liste de
 * prospection », relu le 10 août 2026 (feuille modifiée le 7 août 2026).
 *
 * **Transcription, pas règle.** Chaque entrée porte le numéro de sa ligne source
 * et la preuve qui a motivé la décision, pour qu'on puisse la contester dans six
 * mois sans rouvrir le tableur. La feuille reste en lecture seule — rien n'y a
 * été écrit.
 *
 * Deux colonnes sont lues, et c'est délibéré : `Statut Contact` porte
 * « À contacter » / « Contacté », mais **« Pas intéressé » n'y figure pas** —
 * c'est une valeur de la colonne `Réponse ?`. Ne lire que la première aurait
 * laissé vingt-sept refus explicites dans le vivier à prospecter.
 *
 * Priorité : un refus l'emporte sur le statut de contact. Neuf lignes portent
 * « À contacter » **et** « Pas intéressé » — une contradiction de la feuille,
 * signalée à la simulation plutôt que tranchée en silence.
 */
export type StatusKind = "never" | "waiting" | "lost";

/**
 * Date de dernière modification de la feuille, telle que Drive la rapporte.
 *
 * C'est la coupure qui départage : ce que la feuille sait est antérieur à cet
 * instant, donc tout travail consigné dans le CRM **après** l'emporte sur elle.
 * Une transcription vieille de trois jours n'a pas à écraser un appel passé
 * hier.
 */
export const SHEET_MODIFIED_AT = new Date("2026-08-07T17:34:43.494Z");

export interface SheetStatus {
  /** Ligne dans la feuille source. Sert à retrouver l'origine d'une décision. */
  readonly row: number;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly company: string;
  readonly kind: StatusKind;
  /** Statut saisi visé. Vide pour un refus : la perte se dit par le cycle de vie. */
  readonly status: string;
  /** Cycle de vie visé. Vide = inchangé. */
  readonly lifecycle: string;
  readonly lostReason: string;
  readonly evidence: string;
}

export const SHEET_STATUSES: readonly SheetStatus[] = [
  { row: 1, firstName: "Gregoire", lastName: "Rolland", email: "gregoire.rolland@capiplante.fr", company: "Capiplante", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 1 : Statut Contact « Contacté », réponse « En attente »" },
  { row: 2, firstName: "", lastName: "", email: "juliettemunoz@la-canopee.com", company: "Canopée", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 2 : Statut Contact « À contacter »" },
  { row: 3, firstName: "Shirley", lastName: "Billot", email: "shirley.billot@kadalys.com", company: "Kadalys", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 3 : Statut Contact « Contacté », réponse « En attente »" },
  { row: 4, firstName: "Louise", lastName: "Marie", email: "louise.marie@nailmatic.com", company: "Nailmatic", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 4 : Statut Contact « Contacté », réponse « En attente »" },
  { row: 5, firstName: "Sarah", lastName: "Pouchet", email: "", company: "Unbottled", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 5 : Statut Contact « À contacter »" },
  { row: 6, firstName: "", lastName: "", email: "", company: "Seasonly", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 6 : Statut Contact « À contacter »" },
  { row: 7, firstName: "Sophie", lastName: "Parra", email: "sophie@comme-avant.bio", company: "Comme Avant", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 7 : Statut Contact « Contacté », réponse « En attente »" },
  { row: 8, firstName: "Quentin", lastName: "Reygrobellet", email: "quentin@blissim.fr", company: "Blissim", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 8 : Statut Contact « À contacter »" },
  { row: 9, firstName: "Louis", lastName: "Marty", email: "louis@mercihandy.com", company: "Merci Handy", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 9 : Statut Contact « À contacter »" },
  { row: 10, firstName: "Daphne", lastName: "Valeri", email: "daphne@clemenceetvivien.com", company: "Clemence et Vivien", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 10 : Statut Contact « Contacté », réponse « En attente »" },
  { row: 11, firstName: "Isabelle", lastName: "Carron", email: "isabelle.carron@teledyne.com", company: "Absolution", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 11 : Statut Contact « À contacter »" },
  { row: 12, firstName: "Alexis", lastName: "Dhellemmes", email: "alexis@avril-beaute.fr", company: "Avril", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 12 : Statut Contact « Contacté », réponse « En attente »" },
  { row: 13, firstName: "Carla", lastName: "Villa", email: "carla.villa@typology.com", company: "Typology", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 13 : Statut Contact « Contacté », réponse « En attente »" },
  { row: 14, firstName: "Helene", lastName: "Azancot", email: "helene.azancot@yodibeauty.com", company: "Yodi", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 14 : Statut Contact « Contacté », réponse « En attente »" },
  { row: 15, firstName: "Laure", lastName: "Favre", email: "laure.favre@teledyne.com", company: "Spring", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 15 : Statut Contact « À contacter »" },
  { row: 16, firstName: "Margaux", lastName: "Cannoni", email: "margaux.cannoni@gmail.com", company: "Jolly Mama", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 16 : Statut Contact « À contacter »" },
  { row: 17, firstName: "Clément", lastName: "Scellier", email: "clement@jiminis.com", company: "Jiminis", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 17 : Statut Contact « À contacter »" },
  { row: 18, firstName: "Christophe", lastName: "Vallet", email: "christophe.vallet@authentichotels.com", company: "", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 18 : Statut Contact « À contacter »" },
  { row: 19, firstName: "Regis", lastName: "Masson", email: "regis.masson@aerolithe.fr", company: "", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 19 : Statut Contact « À contacter »" },
  { row: 20, firstName: "Pierre", lastName: "Hengoat", email: "pierre.hengoat@lafrairie.com", company: "", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 20 : Statut Contact « À contacter »" },
  { row: 21, firstName: "Laura", lastName: "", email: "laura@nurture-for-life.com", company: "", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 21 : Statut Contact « À contacter »" },
  { row: 22, firstName: "Marion", lastName: "Teuliere", email: "", company: "Soin de Soi", kind: "lost", status: "", lifecycle: "Perdu", lostReason: "Pas intéressé", evidence: "feuille ligne 22 : Réponse « Pas intéressé »" },
  { row: 23, firstName: "Céline", lastName: "Dirani", email: "", company: "Rebelle", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 23 : Statut Contact « À contacter »" },
  { row: 24, firstName: "", lastName: "", email: "theo@bonparfumeur.com", company: "", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 24 : Statut Contact « Contacté », réponse « En attente »" },
  { row: 25, firstName: "", lastName: "", email: "", company: "", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 25 : Statut Contact « À contacter »" },
  { row: 26, firstName: "Nelly", lastName: "Pelissier-Hermitte", email: "", company: "Soin de Soi", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 26 : Statut Contact « À contacter »" },
  { row: 27, firstName: "Céline", lastName: "Archer", email: "celine.archer@alvadiem.fr", company: "Alvadiem", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 27 : Statut Contact « Contacté », réponse « En attente »" },
  { row: 28, firstName: "Ridha", lastName: "", email: "", company: "Origine CBD", kind: "lost", status: "", lifecycle: "Perdu", lostReason: "Pas intéressé", evidence: "feuille ligne 28 : Réponse « Pas intéressé »" },
  { row: 29, firstName: "Lizeth", lastName: "Barrera", email: "lbarrera@comblee.com", company: "Comblée", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 29 : Statut Contact « Contacté », réponse « ð Intéressé »" },
  { row: 30, firstName: "Amelie", lastName: "desazard", email: "", company: "Skin et out", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 30 : Statut Contact « Contacté », réponse « En attente »" },
  { row: 31, firstName: "Katia", lastName: "tardy", email: "", company: "Kignon", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 31 : Statut Contact « À contacter »" },
  { row: 32, firstName: "Sandra", lastName: "Giner", email: "sandra@mymosa.fr", company: "Mymosa", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 32 : Statut Contact « Contacté », réponse « En attente »" },
  { row: 33, firstName: "Laeticia", lastName: "Martinez", email: "", company: "Skintips", kind: "lost", status: "", lifecycle: "Perdu", lostReason: "Pas intéressé", evidence: "feuille ligne 33 : Réponse « Pas intéressé »" },
  { row: 34, firstName: "Allan", lastName: "le bronnec", email: "", company: "Kerbi", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 34 : Statut Contact « À contacter »" },
  { row: 35, firstName: "Antoine", lastName: "mignot", email: "antoine.mignot@labomai.com", company: "Activlong", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 35 : Statut Contact « Contacté », réponse « Pas de réponse »" },
  { row: 36, firstName: "jimmy", lastName: "guittonneau", email: "jimmy@beaute-insolente.com", company: "beaute insolente", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 36 : Statut Contact « Contacté », réponse « Pas de réponse »" },
  { row: 37, firstName: "", lastName: "", email: "assistante@divasfabulous.com", company: "Divasfabulous", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 37 : Statut Contact « Contacté », réponse « Pas de réponse »" },
  { row: 38, firstName: "Enguerrand", lastName: "le bigot", email: "lebigot.enguerrand@gmail.com", company: "Puissante", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 38 : Statut Contact « À contacter »" },
  { row: 39, firstName: "Julie", lastName: "julie pernet", email: "julie@makemymask.com", company: "Make my mask", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 39 : Statut Contact « Contacté », réponse « Pas de réponse »" },
  { row: 40, firstName: "Camille", lastName: "pereira", email: "camille@medene.fr", company: "Medene", kind: "lost", status: "", lifecycle: "Perdu", lostReason: "Pas intéressé", evidence: "feuille ligne 40 : Réponse « Pas intéressé »" },
  { row: 41, firstName: "Agathe", lastName: "Verrier", email: "agathe.verrier@gmail.com", company: "Ma petite laine", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 41 : Statut Contact « Contacté », réponse « A répondu »" },
  { row: 42, firstName: "Emma", lastName: "everard", email: "emna@pulseprotein.co", company: "KAZIDOMI", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 42 : Statut Contact « Contacté »" },
  { row: 43, firstName: "Emeric", lastName: "baraca", email: "emeric@cozie-bio.com", company: "Cozie bio", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 43 : Statut Contact « Contacté », réponse « En attente »" },
  { row: 44, firstName: "Delphine", lastName: "hogan lacroix", email: "delphine@horeecosmetiques.com", company: "horeecosmetique", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 44 : Statut Contact « À contacter »" },
  { row: 46, firstName: "Anne", lastName: "sophie", email: "", company: "On the wild side cosmetics", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 46 : Statut Contact « À contacter »" },
  { row: 47, firstName: "Aurore", lastName: "humez-leray", email: "", company: "l'armoire à beauté", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 47 : Statut Contact « À contacter »" },
  { row: 48, firstName: "Alexandra", lastName: "Dutartre", email: "", company: "NYAMI", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 48 : Statut Contact « À contacter »" },
  { row: 49, firstName: "Elodie", lastName: "carpentier", email: "", company: "Le rouge francais", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 49 : Statut Contact « À contacter »" },
  { row: 50, firstName: "Christian", lastName: "Jorge", email: "christian.jorge@omie.fr", company: "Omnie", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 50 : Statut Contact « Contacté »" },
  { row: 51, firstName: "Nadir", lastName: "Tayache", email: "n.tayach@naali.fr", company: "Naali", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 51 : Statut Contact « À contacter »" },
  { row: 52, firstName: "Raphaella", lastName: "nolleau", email: "raphaella@yacon.co", company: "Yacon & Co", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 52 : Statut Contact « À contacter »" },
  { row: 53, firstName: "Mathilde", lastName: "Lacombe", email: "", company: "Aime skincare", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 53 : Statut Contact « À contacter »" },
  { row: 54, firstName: "Clément", lastName: "poyade", email: "clement.poyade@gmail.com", company: "Yacon & Co", kind: "lost", status: "", lifecycle: "Perdu", lostReason: "Pas intéressé", evidence: "feuille ligne 54 : Réponse « Pas intéressé »" },
  { row: 55, firstName: "Jeanne", lastName: "rose gaston", email: "", company: "Hydrolite", kind: "lost", status: "", lifecycle: "Perdu", lostReason: "Pas intéressé", evidence: "feuille ligne 55 : Réponse « Pas intéressé »" },
  { row: 56, firstName: "Yann", lastName: "Grosjean", email: "yann@lugus.agency", company: "Agence shopify expert", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 56 : Statut Contact « Contacté »" },
  { row: 57, firstName: "Meganne", lastName: "rocca", email: "", company: "NOVEM", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 57 : Statut Contact « À contacter »" },
  { row: 58, firstName: "maelle", lastName: "mioche", email: "", company: "Agence shopify expert", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 58 : Statut Contact « Contacté »" },
  { row: 59, firstName: "Loic", lastName: "Blancher", email: "loic@gradiweb.com", company: "Agence shopify expert", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 59 : Statut Contact « Contacté »" },
  { row: 60, firstName: "Luc", lastName: "olivier perret", email: "pieretlo@outlook.com", company: "Ramdam social", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 60 : Statut Contact « À contacter »" },
  { row: 61, firstName: "Bara", lastName: "amouyal", email: "baraamouyal@gmail.com", company: "Flocon", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 61 : Statut Contact « À contacter »" },
  { row: 62, firstName: "Carine", lastName: "Ndongue", email: "carine@oomylab.com", company: "AGENCE INCARE Marketing", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 62 : Statut Contact « À contacter »" },
  { row: 63, firstName: "Sandrine", lastName: "sophie", email: "sandrine.sophie@kalia-nature.com", company: "Kalia nature", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 63 : Statut Contact « À contacter »" },
  { row: 64, firstName: "Emile", lastName: "main", email: "", company: "JANE", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 64 : Statut Contact « À contacter »" },
  { row: 65, firstName: "Reginald", lastName: "andré", email: "reginald.andre@evashair.fr", company: "Evas hair", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 65 : Statut Contact « Contacté »" },
  { row: 66, firstName: "Coline", lastName: "bertrand", email: "coline.bertrand@larosee-cosmetiques.com", company: "La rosé cosmétique", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 66 : Statut Contact « À contacter »" },
  { row: 67, firstName: "Claire", lastName: "flandin", email: "claire.flandin@yahoo.com", company: "Maison jearom", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 67 : Statut Contact « Contacté »" },
  { row: 68, firstName: "Virginie", lastName: "bapaume", email: "virginie@23beauty.paris", company: "23 beauty paris", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 68 : Statut Contact « À contacter »" },
  { row: 69, firstName: "Jeremy", lastName: "pohu", email: "jeremy@maisonmatcha.co", company: "Maison matcha", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 69 : Statut Contact « À contacter »" },
  { row: 70, firstName: "karim", lastName: "boucenna(resp e-commerce)", email: "k.boucenna@naali.fr", company: "NAALI", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 70 : Statut Contact « Contacté »" },
  { row: 71, firstName: "Mathilde", lastName: "l'helogoualc'h", email: "", company: "Nube beauty", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 71 : Statut Contact « Contacté »" },
  { row: 72, firstName: "Anne", lastName: "marie gabelica", email: "amg@oolution.com", company: "", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 72 : Statut Contact « Contacté »" },
  { row: 73, firstName: "Aminata", lastName: "Mbaye", email: "ambaye@wurecosmetics.com", company: "WURE", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 73 : Statut Contact « À contacter »" },
  { row: 74, firstName: "Jennifer", lastName: "mouillot", email: "jennifer@gapianne.com", company: "Gapianne", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 74 : Statut Contact « Contacté »" },
  { row: 75, firstName: "Elise", lastName: "postil", email: "elise.postil@twentydc.com", company: "Twenty dc", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 75 : Statut Contact « Contacté »" },
  { row: 76, firstName: "Whalid", lastName: "ouachache", email: "owhalid@yahoo.fr", company: "KYMSSIA", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 76 : Statut Contact « Contacté »" },
  { row: 77, firstName: "Benjamin", lastName: "bienert", email: "benjamin@bibo-boissons.fr", company: "BIBO", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 77 : Statut Contact « À contacter »" },
  { row: 78, firstName: "Gabriel", lastName: "augusto", email: "gabriel.augusto@loveandgreen.fr", company: "Loveandgreen", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 78 : Statut Contact « À contacter »" },
  { row: 79, firstName: "Pascal", lastName: "charpentier", email: "pcharpentier@argalys.com", company: "Argalys", kind: "lost", status: "", lifecycle: "Perdu", lostReason: "Pas intéressé", evidence: "feuille ligne 79 : Réponse « Pas intéressé »" },
  { row: 80, firstName: "Leo", lastName: "moja", email: "leo.moja@909-upcycling.com", company: "Upcycling", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 80 : Statut Contact « À contacter »" },
  { row: 81, firstName: "Patrice", lastName: "Marin", email: "patrice@nandara.com", company: "Nandara", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 81 : Statut Contact « À contacter »" },
  { row: 82, firstName: "Sylvain", lastName: "barraud", email: "sylvain.barraud@dynamiz.fr", company: "Dynamiz", kind: "lost", status: "", lifecycle: "Perdu", lostReason: "Pas intéressé", evidence: "feuille ligne 82 : Réponse « Pas intéressé »" },
  { row: 83, firstName: "Julien", lastName: "rebaud", email: "julien.rebaud@les-bienfaits.fr", company: "Les bienfait", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 83 : Statut Contact « À contacter »" },
  { row: 84, firstName: "Marion", lastName: "henrio", email: "marion.henrio@miumlab.com", company: "Expert shopify mium", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 84 : Statut Contact « À contacter »" },
  { row: 85, firstName: "Camille", lastName: "decreux", email: "cdecreux@fierslamarque.fr", company: "FIERS", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 85 : Statut Contact « Contacté »" },
  { row: 86, firstName: "Damien", lastName: "Reny", email: "damien@hexa3.eu", company: "HEXA3", kind: "lost", status: "", lifecycle: "Perdu", lostReason: "Pas intéressé", evidence: "feuille ligne 86 : Réponse « Pas intéressé »" },
  { row: 87, firstName: "David", lastName: "coirrault", email: "david@botanistsmanuka.com", company: "BOTANIST", kind: "lost", status: "", lifecycle: "Perdu", lostReason: "Pas intéressé", evidence: "feuille ligne 87 : Réponse « Pas intéressé »" },
  { row: 88, firstName: "Alexis", lastName: "muller", email: "alexis@labelleboucle.fr", company: "La belle boucle", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 88 : Statut Contact « À contacter »" },
  { row: 89, firstName: "Elena", lastName: "andrikian", email: "elena@labelleboucle.fr", company: "Projet ecom la belle boucle", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 89 : Statut Contact « Contacté »" },
  { row: 90, firstName: "Mathieu", lastName: "sorosina", email: "mathieu@olow.fr", company: "Olow", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 90 : Statut Contact « Contacté », réponse « A répondu »" },
  { row: 91, firstName: "Jean", lastName: "larmanjat", email: "jean@casyx.com", company: "Casyx", kind: "lost", status: "", lifecycle: "Perdu", lostReason: "Pas intéressé", evidence: "feuille ligne 91 : Réponse « Pas intéressé »" },
  { row: 92, firstName: "Marc", lastName: "andré lacarelle", email: "marc@equilibrist-lab.com", company: "equilibrist", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 92 : Statut Contact « À contacter »" },
  { row: 93, firstName: "Martin", lastName: "tauber", email: "martin@celadon-paris.com", company: "Céladon paris", kind: "lost", status: "", lifecycle: "Perdu", lostReason: "Pas intéressé", evidence: "feuille ligne 93 : Réponse « Pas intéressé » alors que le statut de la feuille est « À contacter »" },
  { row: 94, firstName: "Tanguy", lastName: "Delecourt", email: "tanguy@caats.co", company: "Caats", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 94 : Statut Contact « À contacter »" },
  { row: 95, firstName: "Nicolas", lastName: "vauvillier", email: "", company: "1001 hobbies", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 95 : Statut Contact « À contacter »" },
  { row: 96, firstName: "Service", lastName: "client", email: "hello@cuure.com", company: "Cuure", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 96 : Statut Contact « À contacter »" },
  { row: 97, firstName: "Hugo", lastName: "Fachin", email: "facchin@visimitra.com", company: "Cuure", kind: "lost", status: "", lifecycle: "Perdu", lostReason: "Pas intéressé", evidence: "feuille ligne 97 : Réponse « Pas intéressé » alors que le statut de la feuille est « À contacter »" },
  { row: 98, firstName: "Anouk", lastName: "le terrier", email: "anouk@dijo.fr", company: "Dijo", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 98 : Statut Contact « À contacter »" },
  { row: 99, firstName: "Victor", lastName: "Montaucet", email: "", company: "Agence ads", kind: "lost", status: "", lifecycle: "Perdu", lostReason: "Pas intéressé", evidence: "feuille ligne 99 : Réponse « Pas intéressé »" },
  { row: 100, firstName: "Nathalie", lastName: "Dabin", email: "nathalie.dabin@mademoisellecosmetique.com", company: "Laboratoire mademoiselle", kind: "lost", status: "", lifecycle: "Perdu", lostReason: "Pas intéressé", evidence: "feuille ligne 100 : Réponse « Pas intéressé »" },
  { row: 101, firstName: "Alexandra", lastName: "herrau, mais possible numéro de son équipe", email: "", company: "FLOWI", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 101 : Statut Contact « Contacté », réponse « A répondu »" },
  { row: 102, firstName: "Lorène", lastName: "Pernet", email: "l.pernet@u-paris.fr", company: "Sisi la paillette", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 102 : Statut Contact « À contacter »" },
  { row: 103, firstName: "Florian", lastName: "Hamzij", email: "florian@feedbii.com", company: "Dedi Agency", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 103 : Statut Contact « Contacté »" },
  { row: 104, firstName: "Mariya", lastName: "Vasyuk", email: "mariya@colibrity.com", company: "Colibrity agence", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 104 : Statut Contact « Contacté »" },
  { row: 105, firstName: "David", lastName: "guennoun", email: "david.gueunoun@miumlab.com", company: "Mium", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 105 : Statut Contact « À contacter »" },
  { row: 106, firstName: "Anne", lastName: "Cecile", email: "annec.descail@gmail.com", company: "Gapianne", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 106 : Statut Contact « Contacté »" },
  { row: 107, firstName: "Jordan", lastName: "Dutto", email: "j.dutto@pleiades-studio.com", company: "Agence boutique shopify", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 107 : Statut Contact « Contacté »" },
  { row: 108, firstName: "Adjinaya", lastName: "Coulibaly", email: "", company: "AMS beauty", kind: "lost", status: "", lifecycle: "Perdu", lostReason: "Pas intéressé", evidence: "feuille ligne 108 : Réponse « Pas intéressé » alors que le statut de la feuille est « À contacter »" },
  { row: 109, firstName: "Adrien", lastName: "coelho", email: "adrien@coelhobeauty.com", company: "Coelho beauty", kind: "lost", status: "", lifecycle: "Perdu", lostReason: "Pas intéressé", evidence: "feuille ligne 109 : Réponse « Pas intéressé » alors que le statut de la feuille est « À contacter »" },
  { row: 110, firstName: "Didier", lastName: "Arthaud", email: "didier.arthaud@66-30.com", company: "66-30", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 110 : Statut Contact « À contacter »" },
  { row: 111, firstName: "Giovanni", lastName: "amico", email: "giovanni.amico@copains-paris.com", company: "Copain paris", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 111 : Statut Contact « À contacter »" },
  { row: 112, firstName: "Angelik", lastName: "iffencker", email: "angelik.iffennecker@lesourcil.com", company: "Le sourcil", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 112 : Statut Contact « Contacté »" },
  { row: 113, firstName: "Coralie", lastName: "sousa", email: "coralie@muzon.fr", company: "Muzon", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 113 : Statut Contact « À contacter »" },
  { row: 114, firstName: "Claire", lastName: "leina", email: "claireleina@allthewaystosay.com", company: "All the way to say", kind: "lost", status: "", lifecycle: "Perdu", lostReason: "Pas intéressé", evidence: "feuille ligne 114 : Réponse « Pas intéressé » alors que le statut de la feuille est « À contacter »" },
  { row: 115, firstName: "François", lastName: "bonnat", email: "francois@thesmilist.co", company: "the smilist", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 115 : Statut Contact « À contacter »" },
  { row: 116, firstName: "Mathilde", lastName: "gaymard", email: "mathilde@numorning.com", company: "Numorning", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 116 : Statut Contact « À contacter »" },
  { row: 117, firstName: "Lucie", lastName: "duhamel", email: "lucie.duhamel@theminimalisthome.fr", company: "the minimalist home", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 117 : Statut Contact « À contacter »" },
  { row: 118, firstName: "Carine", lastName: "bozon", email: "carine.bozon@aglaiaco.com", company: "aglaicao", kind: "lost", status: "", lifecycle: "Perdu", lostReason: "Pas intéressé", evidence: "feuille ligne 118 : Réponse « Pas intéressé »" },
  { row: 119, firstName: "Juliette", lastName: "levy", email: "jlevy@ohmycream.com", company: "Oh my cream", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 119 : Statut Contact « À contacter »" },
  { row: 120, firstName: "Laurent", lastName: "Pan", email: "partnership@secretdepeau.fr", company: "Skin cafeine", kind: "lost", status: "", lifecycle: "Perdu", lostReason: "Pas intéressé", evidence: "feuille ligne 120 : Réponse « Pas intéressé »" },
  { row: 121, firstName: "Julien", lastName: "aguilera", email: "julien.aguilera@glamellinacosmetics.com", company: "Glamelina", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 121 : Statut Contact « À contacter »" },
  { row: 122, firstName: "Paul", lastName: "Mckey", email: "paul.mckey@reifynutrition.com", company: "Reyfu  nutrition", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 122 : Statut Contact « À contacter »" },
  { row: 123, firstName: "Camille", lastName: "de bascher", email: "", company: "Bacha", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 123 : Statut Contact « À contacter »" },
  { row: 124, firstName: "Cyrielle", lastName: "maures", email: "cyrielle@refeelnaturals.com", company: "refeelnaturals", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 124 : Statut Contact « Contacté »" },
  { row: 125, firstName: "Wladimir", lastName: "topaloff", email: "wtopaloff@nubiance.fr", company: "Nubiance", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 125 : Statut Contact « À contacter »" },
  { row: 126, firstName: "Joel", lastName: "drai", email: "", company: "Blue skincare", kind: "lost", status: "", lifecycle: "Perdu", lostReason: "Pas intéressé", evidence: "feuille ligne 126 : Réponse « Pas intéressé » alors que le statut de la feuille est « À contacter »" },
  { row: 127, firstName: "", lastName: "", email: "alexandre.garnier@novoma.com", company: "", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 127 : Statut Contact « Contacté »" },
  { row: 128, firstName: "Florian", lastName: "petitjean", email: "florian.petitjean@olisma.fr", company: "Olisma", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 128 : Statut Contact « Contacté »" },
  { row: 129, firstName: "Claire teixeira", lastName: "", email: "claire@rosaeparis.com", company: "Roseaparis", kind: "lost", status: "", lifecycle: "Perdu", lostReason: "Pas intéressé", evidence: "feuille ligne 129 : Réponse « Pas intéressé » alors que le statut de la feuille est « À contacter »" },
  { row: 130, firstName: "Maxime", lastName: "richard", email: "maxime.richard@nuoo.fr", company: "Nuoo", kind: "lost", status: "", lifecycle: "Perdu", lostReason: "Pas intéressé", evidence: "feuille ligne 130 : Réponse « Pas intéressé » alors que le statut de la feuille est « À contacter »" },
  { row: 131, firstName: "Antoine", lastName: "jeannin", email: "antoine@boardingring.com", company: "boarding", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 131 : Statut Contact « À contacter »" },
  { row: 132, firstName: "Saskia", lastName: "slama", email: "saskia@pomad.paris", company: "Pomad", kind: "lost", status: "", lifecycle: "Perdu", lostReason: "Pas intéressé", evidence: "feuille ligne 132 : Réponse « Pas intéressé »" },
  { row: 133, firstName: "Dieynaba", lastName: "Ndoye", email: "ndoye@waamcosmetics.com", company: "Waamcosmetics", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 133 : Statut Contact « À contacter »" },
  { row: 134, firstName: "Anne", lastName: "Querard", email: "anne@hozhoparis.com", company: "Hozhoparis", kind: "lost", status: "", lifecycle: "Perdu", lostReason: "Pas intéressé", evidence: "feuille ligne 134 : Réponse « Pas intéressé » alors que le statut de la feuille est « À contacter »" },
  { row: 135, firstName: "Paul", lastName: "etienne jacob", email: "paul-etienne@epycure.com", company: "epycure", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 135 : Statut Contact « À contacter »" },
  { row: 136, firstName: "Camille", lastName: "ringot", email: "camille@gyneika.com", company: "gyneika", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 136 : Statut Contact « À contacter »" },
  { row: 137, firstName: "Gina ceku", lastName: "", email: "gina@carel.fr", company: "Carel paris", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 137 : Statut Contact « À contacter - Tél »" },
  { row: 138, firstName: "Estelle xie", lastName: "", email: "exie@inesdelafressange.fr", company: "Ines de la fressange", kind: "lost", status: "", lifecycle: "Perdu", lostReason: "Pas intéressé", evidence: "feuille ligne 138 : Réponse « Pas intéressé »" },
  { row: 139, firstName: "Celine pubert", lastName: "", email: "cpubert@audencia.com", company: "PAUL KA", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 139 : Statut Contact « À contacter »" },
  { row: 140, firstName: "Margaux", lastName: "", email: "margaux@nebuleusebijoux.com", company: "Nébuleuse bijoux", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 140 : Statut Contact « À contacter »" },
  { row: 141, firstName: "Hanna", lastName: "", email: "hanna@march-lab.com", company: "Marchlab", kind: "lost", status: "", lifecycle: "Perdu", lostReason: "Pas intéressé", evidence: "feuille ligne 141 : Réponse « Pas intéressé »" },
  { row: 142, firstName: "Rossana boudet", lastName: "", email: "r.boudet@antikbatik.fr", company: "Antik batik", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 142 : Statut Contact « À contacter »" },
  { row: 143, firstName: "Emma", lastName: "heidari", email: "emma.heidari@larosee-cosmetiques.com", company: "La rosée cosmétique", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 143 : Statut Contact « Contacté »" },
  { row: 144, firstName: "Stéphanie", lastName: "gastaldin", email: "s.gastaldin@linaeskincare.com", company: "Linaeskincare", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 144 : Statut Contact « À contacter »" },
  { row: 145, firstName: "Jessica", lastName: "patron ( recrutement)", email: "jessica@ams-beauty.com", company: "Ams beuty", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 145 : Statut Contact « Contacté », réponse « A répondu »" },
  { row: 146, firstName: "Chloe", lastName: "hourticot", email: "chloe.hourticot@kreme-paris.com", company: "kreme", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 146 : Statut Contact « À contacter »" },
  { row: 147, firstName: "Elena", lastName: "andrikian", email: "elena@labelleboucle.fr", company: "La belle boucle", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 147 : Statut Contact « Contacté »" },
  { row: 148, firstName: "Caroline", lastName: "Lanson", email: "caroline@miye.care", company: "Miye car", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 148 : Statut Contact « À contacter - Tél »" },
  { row: 149, firstName: "Etienne", lastName: "garcia", email: "etienne@roads.social", company: "Roads agence", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 149 : Statut Contact « À contacter »" },
  { row: 150, firstName: "Felix", lastName: "guerin", email: "felix@agence-straton.fr", company: "agence straton", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 150 : Statut Contact « Contacté »" },
  { row: 151, firstName: "Dominique", lastName: "karner", email: "dominic@askmeads.com", company: "agence Ask mead", kind: "never", status: "Jamais contacté", lifecycle: "", lostReason: "", evidence: "feuille ligne 151 : Statut Contact « À contacter - Tél »" },
  { row: 152, firstName: "Mickael", lastName: "fradin", email: "mike@nateev.fr", company: "Agence nateev", kind: "waiting", status: "Contacté — en attente", lifecycle: "", lostReason: "", evidence: "feuille ligne 152 : Statut Contact « Contacté »" },
];

/** Lignes sans statut exploitable, reportées telles quelles. */
export const SHEET_UNREADABLE: readonly string[] = [
  "ligne 45 — statut vide : Elisabeth  ()",
];
