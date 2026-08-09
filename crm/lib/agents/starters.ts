/**
 * Questions d'amorce, par agent.
 *
 * Elles ouvrent une conversation vide. Volontairement **spécifiques au
 * périmètre** de chacun : « Que peux-tu faire ? » n'apprend rien et se répond
 * par une liste ; « Qui ai-je oublié ? » désigne un travail réel et produit une
 * réponse qu'on peut exécuter dans la minute.
 *
 * Elles vivent avec la personnalité — code, indexé par slug — et non en base :
 * ce sont des amorces vers ce que l'agent *sait faire*, pas un réglage. Les
 * renommer serait sans effet ; les changer demande de savoir ce que l'agent
 * peut réellement lire, donc c'est une décision de développement.
 *
 * Le sous-titre dit ce qu'on obtient, pas ce que la question veut dire : c'est
 * la promesse de la réponse, en une ligne.
 */

export interface Starter {
  readonly question: string;
  readonly subtitle: string;
}

export const STARTERS: Record<string, readonly Starter[]> = {
  sabrina: [
    { question: "Quelles sont mes trois priorités aujourd'hui ?", subtitle: "L'arbitrage, pas la liste complète" },
    { question: "Qu'est-ce qui cloche dans mes données ?", subtitle: "Fiches incomplètes, sociétés sans contact" },
    { question: "Où en est mon mois ?", subtitle: "Objectif, pipeline pondéré, ce qui manque" },
    { question: "Qu'est-ce que je laisse traîner ?", subtitle: "Les dossiers immobiles que personne ne relance" },
  ],

  sarah: [
    { question: "Qu'est-ce que je fais aujourd'hui ?", subtitle: "Vos relances dues et en retard" },
    { question: "Qui ai-je oublié ?", subtitle: "Les contacts sans nouvelles" },
    { question: "Quels prospects abandonner ?", subtitle: "Ceux qui ne répondent plus" },
    { question: "Prépare mon prochain appel", subtitle: "L'historique avant de composer" },
  ],

  victor: [
    { question: "Quel segment mérite mes efforts ?", subtitle: "Où le portefeuille gagne réellement" },
    { question: "Sur quoi je perds mon temps ?", subtitle: "Les profils qui closent mal, chiffres à l'appui" },
    { question: "À qui je vends, au juste ?", subtitle: "Le portrait réel de vos clients signés" },
    { question: "Qu'est-ce qui a changé ce trimestre ?", subtitle: "Les tendances de fond, pas le bruit" },
  ],

  oxana: [
    { question: "Mes prix tiennent-ils ?", subtitle: "Ce que vos affaires signées disent vraiment" },
    { question: "Combien me coûtent mes remises ?", subtitle: "L'écart entre annoncé et signé" },
    { question: "Quelle offre porte le portefeuille ?", subtitle: "Volume, panier moyen, taux de closing" },
    { question: "Cette affaire est-elle bien tarifée ?", subtitle: "Comparée à vos signatures comparables" },
  ],

  noah: [
    { question: "D'où viennent mes bons clients ?", subtitle: "Les sources qui finissent en signature" },
    { question: "Quelles sources me font perdre du temps ?", subtitle: "Beaucoup de leads, peu d'affaires" },
    { question: "Qui réchauffer en priorité ?", subtitle: "Les leads jamais travaillés qui en valent la peine" },
    { question: "Mon fichier est-il exploitable ?", subtitle: "Ce qui manque avant de pouvoir prospecter" },
  ],

  heloise: [
    { question: "La charge est-elle tenable ?", subtitle: "Ce que porte chacun, en tâches et en affaires" },
    { question: "Quand faudra-t-il être trois ?", subtitle: "Le seuil que vos chiffres approchent" },
    { question: "Qui porte trop de dossiers ?", subtitle: "La répartition réelle du portefeuille" },
    { question: "Qu'est-ce que je devrais déléguer ?", subtitle: "Ce qui n'a pas besoin de vous" },
  ],

  brutus: [
    { question: "Qu'est-ce que je refuse de voir ?", subtitle: "Sans ménagement, avec les chiffres" },
    { question: "Ça tient à dix fois le volume ?", subtitle: "Ce qui casse en premier si ça grossit" },
    { question: "Mon pipeline est-il sincère ?", subtitle: "Les affaires qui ne closeront jamais" },
    { question: "Qu'est-ce qui ne marche pas ?", subtitle: "Le problème que les autres contournent" },
  ],

  /**
   * Étienne est verrouillé : ses amorces ne s'affichent pas, mais elles
   * existent pour que la structure reste uniforme et que le jour où son domaine
   * sera défini, il ne manque rien.
   */
  etienne: [
    { question: "Quel est ton domaine ?", subtitle: "À définir avec l'équipe" },
    { question: "Que sais-tu lire du CRM ?", subtitle: "Aucun outil ne lui est encore ouvert" },
    { question: "Pourquoi es-tu verrouillé ?", subtitle: "Le drapeau AGENT_ETIENNE_ENABLED" },
    { question: "Que devrais-tu devenir ?", subtitle: "La place laissée libre dans le conseil" },
  ],
};

/** Amorces d'un agent. Tableau vide si le slug est inconnu — jamais `undefined`. */
export function startersFor(slug: string): readonly Starter[] {
  return STARTERS[slug] ?? [];
}
