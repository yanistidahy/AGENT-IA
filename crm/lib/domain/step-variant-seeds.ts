import type { ContactGroup } from "./contact-group";
import type { StepTemplate } from "./step-variants";

/**
 * **Les variantes d'étape 1 pré-remplies, une par groupe.**
 *
 * Ce sont des points de départ à retoucher, pas un discours figé : ils vivent
 * dans le code parce qu'ils décrivent ce que le produit sait faire, et une
 * campagne peut les réécrire entièrement — c'est même l'usage attendu.
 *
 * Les règles du discours (jalons 57, 58 et 84) s'appliquent mot pour mot :
 *
 * - « un conseiller de vente », **jamais** « chatbot » ni « Personal Shopper » ;
 * - **aucun prix**, aucun chiffre inventé, **aucune affirmation sur leur
 *   trafic** — on observe leur site, on ne prête rien à leurs visiteurs ;
 * - **aucun tiret long**, la garde du jalon 58 l'impose ici comme ailleurs ;
 * - ne présume jamais d'une équipe (jalon 57) ;
 * - l'hésitation reste une **possibilité**, jamais une promesse.
 */

export interface VariantSeed extends StepTemplate {
  /**
   * Une phrase que l'on peut supprimer telle quelle, signalée dans l'éditeur.
   *
   * Elle existe parce qu'un argument utile à une partie des destinataires est
   * du bruit pour les autres : l'installation Shopify rassure une responsable
   * e commerce et n'intéresse pas une fondatrice. La marquer plutôt que de la
   * retirer d'office laisse le choix, et la nommer évite de la chercher.
   */
  readonly optionalSentence?: string;
}

export const STEP_ONE_SEEDS: Readonly<Record<ContactGroup, VariantSeed>> = {
  direction: {
    subject: "Une démonstration préparée pour {marque}",
    body: [
      "Bonjour {prenom},",
      "En regardant {site}, j'ai préparé une démonstration d'un conseiller de vente pour {marque}. Il répond aux questions des visiteurs la nuit et le week end, quand personne n'est disponible pour le faire.",
      "L'idée est simple : une question qui reste sans réponse est une vente qui ne se fait pas, et ces heures là sont celles où l'on ne peut rien y faire. Un conseiller qui oriente vers le bon produit peut récupérer une partie de ces ventes, sans rien changer à votre site.",
      "Si vous voulez voir ce que cela donne chez vous, répondez à ce message et je vous envoie le lien.",
    ].join("\n\n"),
  },
  marketing: {
    subject: "Une démonstration préparée pour {marque}",
    body: [
      "Bonjour {prenom},",
      "En regardant {site}, j'ai préparé une démonstration d'un conseiller de vente pour {marque}. Il répond aux questions produit au moment où elles se posent, et oriente vers la référence qui correspond.",
      "C'est typiquement le genre de choix sur lequel on hésite : une composition, un format, une compatibilité. Une réponse donnée sur la page peut améliorer la conversion, et éviter qu'un panier reste en route.",
      "L'installation sur Shopify se fait sans développement, si c'est votre cas.",
      "Si vous voulez voir ce que cela donne chez vous, répondez à ce message et je vous envoie le lien.",
    ].join("\n\n"),
    optionalSentence: "L'installation sur Shopify se fait sans développement, si c'est votre cas.",
  },
  commercial: {
    subject: "Une démonstration préparée pour {marque}",
    body: [
      "Bonjour {prenom},",
      "En regardant {site}, j'ai préparé une démonstration d'un conseiller de vente pour {marque}. Il qualifie les demandes qui arrivent et remonte celles qui sont prêtes à acheter.",
      "Les demandes pro et revendeurs passent par le même chemin : le conseiller pose les questions utiles, rassemble les informations et vous les transmet, plutôt que de laisser un message sans suite dans un formulaire.",
      "Si vous voulez voir ce que cela donne chez vous, répondez à ce message et je vous envoie le lien.",
    ].join("\n\n"),
  },
  /*
    **Pas de variante pour « Autre », et c'est une décision.** Ce groupe n'est
    pas un métier : c'est ce qu'aucun mot-clé ne couvre, donc des fonctions qui
    n'ont rien en commun. Leur écrire un angle commun serait deviner. Ils
    reçoivent le message par défaut de l'étape, ce qui est exactement ce que le
    repli est censé faire.
  */
  autre: { subject: "", body: "" },
};
