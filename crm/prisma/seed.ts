import { PrismaClient } from "@prisma/client";

/**
 * Jeu de démonstration.
 *
 * Noyau repris du prototype `auraflow-crm.html` — les 8 sociétés, 12 contacts et
 * 11 affaires d'origine sont conservés tels quels, identifiants compris. Le jeu
 * est étendu aux volumes du brief : 12 sociétés, 18 contacts, 24 affaires, et un
 * historique d'activité couvrant 6 mois pour que les graphiques du tableau de
 * bord et des rapports aient de la matière.
 */

const prisma = new PrismaClient();

const DAY_MS = 86_400_000;
const NOW = new Date();

/** `n` jours avant maintenant. Une valeur négative projette dans le futur. */
function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * DAY_MS);
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// ---------------------------------------------------------------- étapes

const STAGES = [
  { id: "s1", name: "Nouveau lead", color: "#94A9A4", prob: 10, position: 0 },
  { id: "s2", name: "Contacté", color: "#2C7BE5", prob: 25, position: 1 },
  { id: "s3", name: "Démo planifiée", color: "#6D5AE6", prob: 45, position: 2 },
  { id: "s4", name: "Proposition envoyée", color: "#D99323", prob: 65, position: 3 },
  { id: "s5", name: "Négociation", color: "#E8503F", prob: 85, position: 4 },
  { id: "s6", name: "Gagné", color: "#0FA88F", prob: 100, position: 5 },
] as const;

// -------------------------------------------------------------- sociétés

interface CompanySeed {
  id: string;
  name: string;
  domain: string;
  size: string;
  industry: string;
  loc: string;
  desc: string;
  createdAgo: number;
}

const COMPANIES: CompanySeed[] = [
  // --- noyau du prototype ---
  { id: "c1", name: "Pousse Nature", domain: "poussenature.fr", size: "11-50", industry: "Cosmétique bio", loc: "Lyon", desc: "E-commerce Shopify, ~4 000 commandes/mois, SAV saturé", createdAgo: 150 },
  { id: "c2", name: "Maison Vertu", domain: "maisonvertu.com", size: "1-10", industry: "Décoration", loc: "Bordeaux", desc: "Boutique Shopify haut de gamme, forte saisonnalité", createdAgo: 175 },
  { id: "c3", name: "Nutrivia", domain: "nutrivia.fr", size: "51-200", industry: "Compléments alimentaires", loc: "Paris", desc: "DNVB en croissance, 12 000 tickets SAV/mois", createdAgo: 168 },
  { id: "c4", name: "Atelier Solen", domain: "ateliersolen.fr", size: "1-10", industry: "Bijouterie artisanale", loc: "Nantes", desc: "Marque Instagram, gros volume de questions avant-vente", createdAgo: 92 },
  { id: "c5", name: "Kotto Sport", domain: "kottosport.com", size: "51-200", industry: "Équipement sportif", loc: "Lille", desc: "Multi-marketplace, suivi de commande = 60% du SAV", createdAgo: 120 },
  { id: "c6", name: "Bébé Cocon", domain: "bebecocon.fr", size: "11-50", industry: "Puériculture", loc: "Toulouse", desc: "Shopify Plus, service client externalisé coûteux", createdAgo: 140 },
  { id: "c7", name: "Le Comptoir Brut", domain: "comptoirbrut.fr", size: "11-50", industry: "Épicerie fine", loc: "Marseille", desc: "Abonnements mensuels, questions récurrentes livraison", createdAgo: 185 },
  { id: "c8", name: "Hydra Studio", domain: "hydrastudio.co", size: "1-10", industry: "Skincare", loc: "Paris", desc: "Lancement récent, 0 process SAV", createdAgo: 45 },
  // --- extension aux volumes du brief ---
  { id: "c9", name: "Fibre & Laine", domain: "fibreetlaine.fr", size: "11-50", industry: "Textile maille", loc: "Roubaix", desc: "Marque de maille française, pic de SAV en novembre-décembre", createdAgo: 130 },
  { id: "c10", name: "Terra Cave", domain: "terracave.fr", size: "1-10", industry: "Vins nature", loc: "Beaune", desc: "Cave en ligne, conseils avant-vente très chronophages", createdAgo: 60 },
  { id: "c11", name: "Papillon Papeterie", domain: "papillonpapeterie.fr", size: "11-50", industry: "Papeterie créative", loc: "Angers", desc: "Abonnement mensuel, 3 000 commandes/mois, équipe SAV de 2", createdAgo: 78 },
  { id: "c12", name: "Nordik Home", domain: "nordikhome.com", size: "51-200", industry: "Mobilier scandinave", loc: "Strasbourg", desc: "Panier moyen élevé, SAV logistique complexe sur les gros volumes", createdAgo: 105 },
];

// -------------------------------------------------------------- contacts

interface ContactSeed {
  id: string;
  firstName: string;
  lastName: string;
  companyId: string;
  title: string;
  dep: string;
  lifecycle: string;
  source: string;
  owner: string;
  lastContactAgo: number | null;
  nextReminderAgo: number | null;
  notes: string;
  createdAgo: number;
}

const CONTACTS: ContactSeed[] = [
  // --- noyau du prototype ---
  { id: "p1", firstName: "Sophie", lastName: "Meunier", companyId: "c1", title: "Fondatrice", dep: "Direction", lifecycle: "Prospect", source: "LinkedIn", owner: "Yanis", lastContactAgo: 3, nextReminderAgo: -2, notes: "Très réceptive. Son SAV tourne à 3 personnes le lundi.", createdAgo: 60 },
  { id: "p2", firstName: "Marc", lastName: "Delaunay", companyId: "c2", title: "Directeur e-commerce", dep: "E-commerce", lifecycle: "Prospect", source: "Cold Call", owner: "Associé", lastContactAgo: 9, nextReminderAgo: 1, notes: "Veut voir un cas client déco avant de signer.", createdAgo: 60 },
  { id: "p3", firstName: "Inès", lastName: "Rahmani", companyId: "c3", title: "Head of Customer Care", dep: "Service client", lifecycle: "Client", source: "Scraping", owner: "Yanis", lastContactAgo: 5, nextReminderAgo: -12, notes: "Déployé sur Shopify + Gorgias. Très satisfaite.", createdAgo: 160 },
  { id: "p4", firstName: "Solen", lastName: "Guivarch", companyId: "c4", title: "Fondatrice", dep: "Direction", lifecycle: "Lead", source: "Instagram", owner: "Yanis", lastContactAgo: 22, nextReminderAgo: null, notes: "Répond peu. Relancer par DM.", createdAgo: 40 },
  { id: "p5", firstName: "Thomas", lastName: "Bercot", companyId: "c5", title: "Responsable SAV", dep: "Service client", lifecycle: "Prospect", source: "LinkedIn", owner: "Associé", lastContactAgo: 1, nextReminderAgo: -4, notes: "Demande une intégration marketplace.", createdAgo: 55 },
  { id: "p6", firstName: "Camille", lastName: "Ndiaye", companyId: "c6", title: "COO", dep: "Opérations", lifecycle: "Prospect", source: "Recommandation", owner: "Yanis", lastContactAgo: 14, nextReminderAgo: 0, notes: "Budget validé, attend la proposition finale.", createdAgo: 100 },
  { id: "p7", firstName: "Julien", lastName: "Fabre", companyId: "c7", title: "Fondateur", dep: "Direction", lifecycle: "Ancien Client", source: "Cold Email", owner: "Associé", lastContactAgo: 48, nextReminderAgo: null, notes: "Avait testé 2 mois. Parti pour raison budget — à recontacter.", createdAgo: 180 },
  { id: "p8", firstName: "Léa", lastName: "Vasseur", companyId: "c8", title: "Fondatrice", dep: "Direction", lifecycle: "Client", source: "Instagram", owner: "Yanis", lastContactAgo: 2, nextReminderAgo: -6, notes: "Lancement en septembre, timing parfait.", createdAgo: 45 },
  { id: "p9", firstName: "Antoine", lastName: "Rivière", companyId: "c3", title: "CTO", dep: "Technique", lifecycle: "Client", source: "Scraping", owner: "Associé", lastContactAgo: 11, nextReminderAgo: null, notes: "Interlocuteur technique pour l'API.", createdAgo: 150 },
  { id: "p10", firstName: "Nadia", lastName: "Lambert", companyId: "c5", title: "Directrice générale", dep: "Direction", lifecycle: "Prospect", source: "Cold Call", owner: "Yanis", lastContactAgo: 31, nextReminderAgo: null, notes: "Décisionnaire finale. Bloquée depuis un mois.", createdAgo: 110 },
  { id: "p11", firstName: "Hugo", lastName: "Mercier", companyId: "c1", title: "Responsable logistique", dep: "Opérations", lifecycle: "Client", source: "LinkedIn", owner: "Yanis", lastContactAgo: 7, nextReminderAgo: null, notes: "Utilisateur final du bot côté suivi commande.", createdAgo: 140 },
  { id: "p12", firstName: "Élise", lastName: "Chartier", companyId: "c2", title: "Responsable marketing", dep: "Marketing", lifecycle: "Ancien Client", source: "Salon", owner: "Associé", lastContactAgo: 19, nextReminderAgo: 3, notes: "Rencontrée au salon E-commerce Paris.", createdAgo: 170 },
  // --- extension ---
  { id: "p13", firstName: "Marion", lastName: "Lefevre", companyId: "c9", title: "Directrice e-commerce", dep: "E-commerce", lifecycle: "Client", source: "LinkedIn", owner: "Yanis", lastContactAgo: 4, nextReminderAgo: -8, notes: "Pilote transformé. Veut étendre au préachat.", createdAgo: 125 },
  { id: "p14", firstName: "Bastien", lastName: "Roux", companyId: "c10", title: "Fondateur", dep: "Direction", lifecycle: "Prospect", source: "Recommandation", owner: "Associé", lastContactAgo: 3, nextReminderAgo: -5, notes: "Recommandé par Julien Fabre. Sensible au prix.", createdAgo: 55 },
  { id: "p15", firstName: "Awa", lastName: "Traoré", companyId: "c11", title: "Responsable e-commerce", dep: "E-commerce", lifecycle: "Prospect", source: "Cold Email", owner: "Yanis", lastContactAgo: 10, nextReminderAgo: 2, notes: "A répondu au 3e email. Démo faite, réfléchit.", createdAgo: 75 },
  { id: "p16", firstName: "Erwan", lastName: "Le Goff", companyId: "c12", title: "Head of Digital", dep: "E-commerce", lifecycle: "Prospect", source: "Salon", owner: "Associé", lastContactAgo: 2, nextReminderAgo: -3, notes: "Gros compte. Process d'achat en 3 étapes, juridique impliqué.", createdAgo: 100 },
  { id: "p17", firstName: "Chloé", lastName: "Berger", companyId: "c12", title: "Responsable SAV", dep: "Service client", lifecycle: "Lead", source: "Site web", owner: "Yanis", lastContactAgo: 5, nextReminderAgo: null, notes: "A demandé une démo depuis le site. Utilisatrice finale.", createdAgo: 12 },
  { id: "p18", firstName: "Samir", lastName: "Haddad", companyId: "c9", title: "COO", dep: "Opérations", lifecycle: "Client", source: "LinkedIn", owner: "Associé", lastContactAgo: 16, nextReminderAgo: null, notes: "Sponsor budgétaire côté Fibre & Laine.", createdAgo: 130 },
];

// -------------------------------------------------------------- affaires

const OFFERS = {
  starter: "Starter — 299€ + 149€/mois",
  pro: "Pro — 499€ + 249€/mois",
  surMesure: "Sur-Mesure — 799€ + 399€/mois",
  pilote: "Pilote 3 mois",
} as const;

interface DealSeed {
  id: string;
  name: string;
  companyId: string;
  contactId: string;
  amount: number;
  stageId: string;
  owner: string;
  offer: string;
  createdAgo: number;
  expectedCloseAgo: number;
  lastActivityAgo: number;
  status: "open" | "won" | "lost";
  closedAgo?: number;
  notes: string;
}

const DEALS: DealSeed[] = [
  // --- noyau du prototype ---
  { id: "d1", name: "Assistant IA — Pousse Nature", companyId: "c1", contactId: "p1", amount: 6480, stageId: "s4", owner: "Yanis", offer: OFFERS.pro, createdAgo: 34, expectedCloseAgo: -9, lastActivityAgo: 3, status: "open", notes: "Proposition envoyée le 3. Relance prévue." },
  { id: "d2", name: "Assistant IA — Maison Vertu", companyId: "c2", contactId: "p2", amount: 3480, stageId: "s3", owner: "Associé", offer: OFFERS.starter, createdAgo: 21, expectedCloseAgo: -15, lastActivityAgo: 9, status: "open", notes: "Démo à reprogrammer, absente la 1re fois." },
  { id: "d3", name: "Extension API — Nutrivia", companyId: "c3", contactId: "p9", amount: 5400, stageId: "s5", owner: "Associé", offer: OFFERS.surMesure, createdAgo: 40, expectedCloseAgo: -6, lastActivityAgo: 1, status: "open", notes: "Négociation sur le volume de tokens inclus." },
  { id: "d4", name: "Assistant IA — Kotto Sport", companyId: "c5", contactId: "p5", amount: 9180, stageId: "s3", owner: "Associé", offer: OFFERS.surMesure, createdAgo: 17, expectedCloseAgo: -24, lastActivityAgo: 1, status: "open", notes: "Gros potentiel, intégration marketplace à chiffrer." },
  { id: "d5", name: "Assistant IA — Bébé Cocon", companyId: "c6", contactId: "p6", amount: 6480, stageId: "s5", owner: "Yanis", offer: OFFERS.pro, createdAgo: 52, expectedCloseAgo: -3, lastActivityAgo: 14, status: "open", notes: "Budget validé. Attente signature DG." },
  { id: "d6", name: "Assistant IA — Hydra Studio", companyId: "c8", contactId: "p8", amount: 3480, stageId: "s2", owner: "Yanis", offer: OFFERS.starter, createdAgo: 6, expectedCloseAgo: -40, lastActivityAgo: 2, status: "open", notes: "Lancement septembre." },
  { id: "d7", name: "Assistant IA — Atelier Solen", companyId: "c4", contactId: "p4", amount: 3480, stageId: "s1", owner: "Yanis", offer: OFFERS.starter, createdAgo: 26, expectedCloseAgo: -30, lastActivityAgo: 22, status: "open", notes: "Silence radio depuis 3 semaines." },
  { id: "d8", name: "Assistant IA — Nutrivia", companyId: "c3", contactId: "p3", amount: 6480, stageId: "s6", owner: "Yanis", offer: OFFERS.pro, createdAgo: 88, expectedCloseAgo: 58, lastActivityAgo: 58, status: "won", closedAgo: 58, notes: "Signé. Déploiement terminé." },
  { id: "d9", name: "Assistant IA — Le Comptoir Brut", companyId: "c7", contactId: "p7", amount: 3480, stageId: "s4", owner: "Associé", offer: OFFERS.starter, createdAgo: 120, expectedCloseAgo: 70, lastActivityAgo: 70, status: "lost", closedAgo: 70, notes: "Perdu sur le prix. À recontacter en septembre." },
  { id: "d10", name: "Renouvellement — Nutrivia", companyId: "c3", contactId: "p3", amount: 4788, stageId: "s5", owner: "Yanis", offer: OFFERS.pro, createdAgo: 12, expectedCloseAgo: -11, lastActivityAgo: 5, status: "open", notes: "Upsell module recommandations produit." },
  { id: "d11", name: "Assistant IA — Kotto Sport (pilote)", companyId: "c5", contactId: "p10", amount: 2400, stageId: "s6", owner: "Associé", offer: OFFERS.pilote, createdAgo: 75, expectedCloseAgo: 45, lastActivityAgo: 45, status: "won", closedAgo: 45, notes: "Pilote signé puis étendu." },
  // --- extension ---
  { id: "d12", name: "Assistant IA — Fibre & Laine", companyId: "c9", contactId: "p13", amount: 6480, stageId: "s4", owner: "Yanis", offer: OFFERS.pro, createdAgo: 19, expectedCloseAgo: -12, lastActivityAgo: 4, status: "open", notes: "Extension du pilote au préachat. Proposition envoyée." },
  { id: "d13", name: "Assistant IA — Terra Cave", companyId: "c10", contactId: "p14", amount: 3480, stageId: "s2", owner: "Associé", offer: OFFERS.starter, createdAgo: 9, expectedCloseAgo: -35, lastActivityAgo: 3, status: "open", notes: "Recommandation entrante. Premier échange positif." },
  { id: "d14", name: "Assistant IA — Papillon Papeterie", companyId: "c11", contactId: "p15", amount: 6480, stageId: "s3", owner: "Yanis", offer: OFFERS.pro, createdAgo: 28, expectedCloseAgo: -18, lastActivityAgo: 10, status: "open", notes: "Démo faite. Attend l'accord de la fondatrice." },
  { id: "d15", name: "Assistant IA — Nordik Home", companyId: "c12", contactId: "p16", amount: 9180, stageId: "s5", owner: "Associé", offer: OFFERS.surMesure, createdAgo: 44, expectedCloseAgo: -7, lastActivityAgo: 2, status: "open", notes: "Juridique en cours. Plus grosse affaire du pipeline." },
  { id: "d16", name: "Module SAV logistique — Nordik Home", companyId: "c12", contactId: "p17", amount: 5400, stageId: "s1", owner: "Yanis", offer: OFFERS.surMesure, createdAgo: 5, expectedCloseAgo: -55, lastActivityAgo: 5, status: "open", notes: "Demande entrante depuis le site, à qualifier." },
  { id: "d17", name: "Pilote — Fibre & Laine", companyId: "c9", contactId: "p18", amount: 2400, stageId: "s6", owner: "Associé", offer: OFFERS.pilote, createdAgo: 100, expectedCloseAgo: 72, lastActivityAgo: 72, status: "won", closedAgo: 72, notes: "Pilote 3 mois signé, transformé depuis." },
  { id: "d18", name: "Pilote — Pousse Nature", companyId: "c1", contactId: "p11", amount: 2400, stageId: "s6", owner: "Yanis", offer: OFFERS.pilote, createdAgo: 150, expectedCloseAgo: 128, lastActivityAgo: 128, status: "won", closedAgo: 128, notes: "Premier pilote. A ouvert la porte sur le compte." },
  { id: "d19", name: "Assistant IA — Bébé Cocon (starter)", companyId: "c6", contactId: "p6", amount: 3480, stageId: "s6", owner: "Yanis", offer: OFFERS.starter, createdAgo: 130, expectedCloseAgo: 95, lastActivityAgo: 95, status: "won", closedAgo: 95, notes: "Starter signé. Upsell Pro en cours." },
  { id: "d20", name: "Assistant IA — Terra Cave (1re tentative)", companyId: "c10", contactId: "p14", amount: 3480, stageId: "s4", owner: "Associé", offer: OFFERS.starter, createdAgo: 80, expectedCloseAgo: 35, lastActivityAgo: 35, status: "lost", closedAgo: 35, notes: "Trop tôt, pas de budget. Revenu de lui-même depuis." },
  { id: "d21", name: "Pilote — Maison Vertu", companyId: "c2", contactId: "p12", amount: 2400, stageId: "s6", owner: "Associé", offer: OFFERS.pilote, createdAgo: 180, expectedCloseAgo: 160, lastActivityAgo: 160, status: "won", closedAgo: 160, notes: "Pilote non reconduit à l'époque. Nouvelle affaire ouverte depuis." },
  { id: "d22", name: "Assistant IA — Papillon (starter)", companyId: "c11", contactId: "p15", amount: 3480, stageId: "s4", owner: "Yanis", offer: OFFERS.starter, createdAgo: 70, expectedCloseAgo: 15, lastActivityAgo: 15, status: "lost", closedAgo: 15, notes: "Perdu au profit d'un concurrent moins cher. Retour possible." },
  { id: "d23", name: "Pilote — Hydra Studio", companyId: "c8", contactId: "p8", amount: 2400, stageId: "s6", owner: "Yanis", offer: OFFERS.pilote, createdAgo: 44, expectedCloseAgo: 20, lastActivityAgo: 20, status: "won", closedAgo: 20, notes: "Signé avant le lancement produit." },
  { id: "d24", name: "Renouvellement — Kotto Sport", companyId: "c5", contactId: "p5", amount: 6480, stageId: "s2", owner: "Associé", offer: OFFERS.pro, createdAgo: 3, expectedCloseAgo: -60, lastActivityAgo: 1, status: "open", notes: "Passage du pilote au Pro. Discussion ouverte." },
];

// ------------------------------------------------------------ activités

interface ActivitySeed {
  type: string;
  dateAgo: number;
  contactId: string;
  dealId: string | null;
  owner: string;
  notes: string;
  duration: number | null;
}

const ACTIVITIES: ActivitySeed[] = [
  // --- noyau du prototype ---
  { type: "call", dateAgo: 3, contactId: "p1", dealId: "d1", owner: "Yanis", notes: "Point sur la proposition. Elle valide le périmètre, demande un délai de déploiement.", duration: 18 },
  { type: "email", dateAgo: 3, contactId: "p1", dealId: "d1", owner: "Yanis", notes: "Envoi de la proposition Pro + planning de déploiement en 2 semaines.", duration: null },
  { type: "demo", dateAgo: 9, contactId: "p2", dealId: "d2", owner: "Associé", notes: "Démo annulée au dernier moment. Reprogrammée.", duration: 0 },
  { type: "meeting", dateAgo: 1, contactId: "p5", dealId: "d4", owner: "Associé", notes: "Visio 45 min avec le SAV. Volume : 8 000 tickets/mois, 62% suivi de commande.", duration: 45 },
  { type: "call", dateAgo: 1, contactId: "p9", dealId: "d3", owner: "Associé", notes: "Point technique API. Besoin d'un webhook temps réel sur les statuts.", duration: 26 },
  { type: "email", dateAgo: 2, contactId: "p8", dealId: "d6", owner: "Yanis", notes: "Premier contact suite à son post LinkedIn sur le lancement.", duration: null },
  { type: "note", dateAgo: 14, contactId: "p6", dealId: "d5", owner: "Yanis", notes: "Budget validé en comité. Signature attendue avant fin de mois.", duration: null },
  { type: "call", dateAgo: 22, contactId: "p4", dealId: "d7", owner: "Yanis", notes: "Messagerie. 3e tentative sans réponse.", duration: 0 },
  { type: "meeting", dateAgo: 5, contactId: "p3", dealId: "d10", owner: "Yanis", notes: "Revue trimestrielle : 71% de tickets automatisés, note 4,3/5.", duration: 40 },
  { type: "email", dateAgo: 7, contactId: "p11", dealId: "d1", owner: "Yanis", notes: "Envoi de la doc technique sur le suivi de commande.", duration: null },
  { type: "call", dateAgo: 31, contactId: "p10", dealId: "d4", owner: "Yanis", notes: "Présentation rapide. Renvoie vers Thomas pour le cadrage.", duration: 12 },
  { type: "demo", dateAgo: 17, contactId: "p5", dealId: "d4", owner: "Associé", notes: "Démo produit. Très bon accueil, 4 personnes présentes.", duration: 50 },
  // --- extension, 6 mois d'historique ---
  { type: "call", dateAgo: 4, contactId: "p13", dealId: "d12", owner: "Yanis", notes: "Retour sur le pilote : 68% d'automatisation. Feu vert pour étendre au préachat.", duration: 22 },
  { type: "email", dateAgo: 4, contactId: "p13", dealId: "d12", owner: "Yanis", notes: "Proposition Pro envoyée avec le comparatif pilote / Pro.", duration: null },
  { type: "call", dateAgo: 3, contactId: "p14", dealId: "d13", owner: "Associé", notes: "Premier appel. Recommandé par Julien Fabre. Sensible au prix, curieux du ROI.", duration: 19 },
  { type: "demo", dateAgo: 10, contactId: "p15", dealId: "d14", owner: "Yanis", notes: "Démo 35 min. Convaincue, doit obtenir l'accord de la fondatrice.", duration: 35 },
  { type: "meeting", dateAgo: 2, contactId: "p16", dealId: "d15", owner: "Associé", notes: "Comité d'achat. Juridique demande une clause de réversibilité des données.", duration: 60 },
  { type: "email", dateAgo: 5, contactId: "p17", dealId: "d16", owner: "Yanis", notes: "Réponse à sa demande de démo depuis le site. Créneaux proposés.", duration: null },
  { type: "note", dateAgo: 16, contactId: "p18", dealId: "d12", owner: "Associé", notes: "Sponsor budgétaire confirmé. Enveloppe annuelle disponible.", duration: null },
  { type: "call", dateAgo: 20, contactId: "p8", dealId: "d23", owner: "Yanis", notes: "Signature du pilote. Déploiement avant le lancement produit.", duration: 15 },
  { type: "email", dateAgo: 35, contactId: "p14", dealId: "d20", owner: "Associé", notes: "Clôture du dossier : pas de budget cette année. Reste en contact.", duration: null },
  { type: "call", dateAgo: 45, contactId: "p10", dealId: "d11", owner: "Associé", notes: "Signature du pilote Kotto Sport. Extension à discuter au T+3.", duration: 24 },
  { type: "meeting", dateAgo: 58, contactId: "p3", dealId: "d8", owner: "Yanis", notes: "Signature Nutrivia. Kick-off de déploiement planifié.", duration: 55 },
  { type: "call", dateAgo: 70, contactId: "p7", dealId: "d9", owner: "Associé", notes: "Il renonce. Écart de prix trop important avec le concurrent.", duration: 14 },
  { type: "meeting", dateAgo: 72, contactId: "p18", dealId: "d17", owner: "Associé", notes: "Signature du pilote Fibre & Laine.", duration: 45 },
  { type: "email", dateAgo: 88, contactId: "p15", dealId: "d22", owner: "Yanis", notes: "Relance sans réponse. Dossier laissé ouvert.", duration: null },
  { type: "call", dateAgo: 95, contactId: "p6", dealId: "d19", owner: "Yanis", notes: "Signature du Starter. Upsell Pro à envisager dans 3 mois.", duration: 20 },
  { type: "demo", dateAgo: 110, contactId: "p16", dealId: "d15", owner: "Associé", notes: "Première démo Nordik Home, rencontrés au salon.", duration: 50 },
  { type: "meeting", dateAgo: 128, contactId: "p11", dealId: "d18", owner: "Yanis", notes: "Signature du premier pilote Pousse Nature.", duration: 40 },
  { type: "note", dateAgo: 145, contactId: "p1", dealId: "d18", owner: "Yanis", notes: "Retour pilote très positif. Ouvre la voie au déploiement complet.", duration: null },
  { type: "call", dateAgo: 160, contactId: "p12", dealId: "d21", owner: "Associé", notes: "Signature du pilote Maison Vertu.", duration: 18 },
  { type: "email", dateAgo: 175, contactId: "p2", dealId: null, owner: "Associé", notes: "Premier cold email à Maison Vertu.", duration: null },
];

// --------------------------------------------------------------- tâches

interface TaskSeed {
  title: string;
  dueAgo: number;
  priority: string;
  owner: string;
  contactId?: string;
  companyId?: string;
  dealId?: string;
  done?: boolean;
}

const TASKS: TaskSeed[] = [
  { title: "Relancer Sophie sur la proposition", dueAgo: -1, priority: "haute", owner: "Yanis", dealId: "d1" },
  { title: "Reprogrammer la démo Maison Vertu", dueAgo: 0, priority: "haute", owner: "Associé", dealId: "d2" },
  { title: "Chiffrer l'intégration marketplace Kotto", dueAgo: -3, priority: "normale", owner: "Associé", dealId: "d4" },
  { title: "Envoyer le contrat à Bébé Cocon", dueAgo: -2, priority: "haute", owner: "Yanis", dealId: "d5" },
  { title: "DM Instagram à Solen", dueAgo: 2, priority: "basse", owner: "Yanis", contactId: "p4" },
  { title: "Préparer la revue trimestrielle Nutrivia", dueAgo: -7, priority: "normale", owner: "Yanis", companyId: "c3" },
  { title: "Recontacter Le Comptoir Brut (budget septembre)", dueAgo: -25, priority: "basse", owner: "Associé", contactId: "p7" },
  { title: "Appeler Léa avant son lancement", dueAgo: -5, priority: "normale", owner: "Yanis", contactId: "p8" },
  { title: "Envoyer le récap technique webhook à Antoine", dueAgo: 1, priority: "normale", owner: "Associé", dealId: "d3" },
  { title: "Mettre à jour le cas client Nutrivia", dueAgo: 3, priority: "basse", owner: "Yanis", companyId: "c3", done: true },
  { title: "Répondre à la clause de réversibilité Nordik", dueAgo: 1, priority: "haute", owner: "Associé", dealId: "d15" },
  { title: "Qualifier la demande entrante de Chloé Berger", dueAgo: -1, priority: "haute", owner: "Yanis", dealId: "d16" },
  { title: "Relancer Awa Traoré sur l'accord fondatrice", dueAgo: 4, priority: "normale", owner: "Yanis", dealId: "d14" },
  { title: "Envoyer le comparatif pilote / Pro à Marion", dueAgo: -4, priority: "normale", owner: "Yanis", dealId: "d12" },
  { title: "Proposer un créneau à Bastien (Terra Cave)", dueAgo: -2, priority: "normale", owner: "Associé", dealId: "d13" },
  { title: "Check-in 30 jours Hydra Studio", dueAgo: -6, priority: "basse", owner: "Yanis", dealId: "d23" },
];

// ------------------------------------------------------------ séquences

const SEQUENCES = [
  {
    id: "q1",
    name: "Nurturing lead froid",
    trigger: "Lead sans réponse depuis 14 jours",
    active: true,
    steps: [
      { day: 0, channel: "email", label: "Email de reprise : « une idée pour votre SAV »" },
      { day: 3, channel: "linkedin", label: "Message LinkedIn avec le cas client Nutrivia" },
      { day: 8, channel: "call", label: "Appel court : proposer un diagnostic 15 min" },
      { day: 15, channel: "email", label: "Email de clôture : « je referme le dossier ? »" },
    ],
  },
  {
    id: "q2",
    name: "Relance proposition",
    trigger: "Affaire à « Proposition envoyée » depuis 5 jours",
    active: true,
    steps: [
      { day: 0, channel: "email", label: "Email : des questions sur la proposition ?" },
      { day: 4, channel: "call", label: "Appel de relance" },
      { day: 9, channel: "email", label: "Email : offre valable jusqu'au…" },
    ],
  },
  {
    id: "q3",
    name: "Check-in post-vente",
    trigger: "30 jours après la clôture gagnée",
    active: true,
    steps: [
      { day: 30, channel: "email", label: "Email : premiers résultats du bot + taux d'automatisation" },
      { day: 60, channel: "call", label: "Appel qualité + demande de témoignage" },
      { day: 90, channel: "email", label: "Proposition d'upsell (module recommandations)" },
    ],
  },
] as const;

const SETTINGS_LISTS: Record<string, string[]> = {
  owners: ["Yanis", "Associé"],
  offers: [OFFERS.starter, OFFERS.pro, OFFERS.surMesure, OFFERS.pilote],
  sources: ["Cold Call", "Cold Email", "LinkedIn", "Instagram", "Scraping", "Recommandation", "Salon", "Site web"],
  lifecycles: ["Lead", "Prospect", "Client", "Ancien Client"],
};

// ----------------------------------------------------------------- main

/**
 * Chargement du jeu de démonstration.
 *
 * **Tout passe dans une seule transaction.** Le seed commence par vider les dix
 * tables, puis les recharge. Séquentiel et non transactionnel, un échec au
 * milieu — clé étrangère, coupure réseau, conteneur interrompu — laissait les
 * suppressions validées et les insertions perdues : une base intégralement vide,
 * sans message d'erreur visible dans l'application. C'est arrivé en production.
 *
 * Encadré par `$transaction`, un échec annule aussi les suppressions : la base
 * reste telle qu'elle était. Le délai est relevé à 60 s parce que le défaut de
 * Prisma (5 s) est plus court que ce chargement.
 */
async function main(): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await seedAll(tx);
    },
    { timeout: 60_000, maxWait: 15_000 },
  );

  const counts = {
    étapes: await prisma.stage.count(),
    sociétés: await prisma.company.count(),
    contacts: await prisma.contact.count(),
    affaires: await prisma.deal.count(),
    interactions: await prisma.activity.count(),
    tâches: await prisma.task.count(),
    séquences: await prisma.sequence.count(),
  };

  console.log("Seed terminé :");
  for (const [label, count] of Object.entries(counts)) {
    console.log(`  ${label.padEnd(14)} ${count}`);
  }

  if (Object.values(counts).some((count) => count === 0)) {
    console.error("✗ Une table est restée vide : le seed n'a pas abouti.");
    process.exitCode = 1;
  }
}

/** Client de transaction : mêmes modèles que `prisma`, sans `$transaction`. */
type Tx = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

async function seedAll(prisma: Tx): Promise<void> {
  // Ordre de suppression contraint par les clés étrangères.
  await prisma.activity.deleteMany();
  await prisma.task.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.company.deleteMany();
  await prisma.stage.deleteMany();
  await prisma.sequenceStep.deleteMany();
  await prisma.sequence.deleteMany();
  await prisma.settingsList.deleteMany();
  await prisma.settings.deleteMany();

  await prisma.stage.createMany({ data: STAGES.map((stage) => ({ ...stage })) });

  await prisma.settings.create({
    data: { id: "singleton", staleDays: 7, coldDays: 14, objectifMensuel: 15000, notifs: true },
  });

  for (const [kind, values] of Object.entries(SETTINGS_LISTS)) {
    await prisma.settingsList.createMany({
      data: values.map((value, position) => ({ kind, value, position })),
    });
  }

  for (const sequence of SEQUENCES) {
    await prisma.sequence.create({
      data: {
        id: sequence.id,
        name: sequence.name,
        trigger: sequence.trigger,
        active: sequence.active,
        steps: {
          create: sequence.steps.map((step, position) => ({ ...step, position })),
        },
      },
    });
  }

  await prisma.company.createMany({
    data: COMPANIES.map(({ createdAgo, ...company }) => ({
      ...company,
      createdAt: daysAgo(createdAgo),
    })),
  });

  await prisma.contact.createMany({
    data: CONTACTS.map((contact) => {
      const company = COMPANIES.find((c) => c.id === contact.companyId);
      const domain = company?.domain ?? "example.fr";
      return {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        companyId: contact.companyId,
        title: contact.title,
        dep: contact.dep,
        email: `${slug(contact.firstName)}@${domain}`,
        phone: "06 12 34 56 78",
        linkedin: `linkedin.com/in/${slug(contact.firstName)}-${slug(contact.lastName)}`,
        lifecycle: contact.lifecycle,
        source: contact.source,
        owner: contact.owner,
        lastContact: contact.lastContactAgo === null ? null : daysAgo(contact.lastContactAgo),
        nextReminder: contact.nextReminderAgo === null ? null : daysAgo(contact.nextReminderAgo),
        notes: contact.notes,
        createdAt: daysAgo(contact.createdAgo),
      };
    }),
  });

  await prisma.deal.createMany({
    data: DEALS.map((deal) => ({
      id: deal.id,
      name: deal.name,
      companyId: deal.companyId,
      contactId: deal.contactId,
      amount: deal.amount,
      stageId: deal.stageId,
      owner: deal.owner,
      offer: deal.offer,
      status: deal.status,
      prob: null,
      notes: deal.notes,
      createdAt: daysAgo(deal.createdAgo),
      expectedClose: daysAgo(deal.expectedCloseAgo),
      lastActivityAt: daysAgo(deal.lastActivityAgo),
      closedAt: deal.closedAgo === undefined ? null : daysAgo(deal.closedAgo),
    })),
  });

  await prisma.activity.createMany({
    data: ACTIVITIES.map((activity) => {
      const contact = CONTACTS.find((c) => c.id === activity.contactId);
      return {
        type: activity.type,
        date: daysAgo(activity.dateAgo),
        createdAt: daysAgo(activity.dateAgo),
        contactId: activity.contactId,
        dealId: activity.dealId,
        companyId: contact?.companyId ?? null,
        owner: activity.owner,
        notes: activity.notes,
        duration: activity.duration,
      };
    }),
  });

  await prisma.task.createMany({
    data: TASKS.map((task) => ({
      title: task.title,
      due: daysAgo(task.dueAgo),
      priority: task.priority,
      owner: task.owner,
      contactId: task.contactId ?? null,
      companyId: task.companyId ?? null,
      dealId: task.dealId ?? null,
      done: task.done ?? false,
      doneAt: task.done === true ? daysAgo(1) : null,
      createdAt: daysAgo(20),
    })),
  });

}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
