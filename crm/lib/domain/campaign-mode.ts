import { type StepMode } from "./merge-tags";

/**
 * **Le chemin d'une campagne, choisi une fois et en premier.**
 *
 * Le jalon 87 a posé le mode sur **l'étape**, et c'était le bon endroit : c'est
 * l'étape qui écrit, donc c'est elle qui sait comment. Mais l'écran, lui, ne
 * posait la question nulle part : la bascule vivait au fond d'un bloc replié de
 * l'éditeur de séquence (`sequence-steps.tsx`), et l'écran de création ne la
 * mentionnait pas du tout. Une fonctionnalité qu'on ne trouve pas n'existe pas.
 *
 * D'où cette seconde notion, et l'écart entre les deux est la décision :
 *
 * | | Ce que ça décide | Quand ça se choisit |
 * |---|---|---|
 * | `Campaign.mode` | **la voie** : ce que l'écran ouvre, et le mode des étapes créées ensuite | une fois, à la création |
 * | `EmailSequenceStep.mode` | **ce qui compose réellement** ce message-là | par défaut hérité ; se change ensuite, étape par étape |
 *
 * Le second reste la seule autorité à la composition — dupliquer la décision
 * dans la boucle de composition aurait fait deux règles pour un même choix, et
 * c'est toujours la seconde qui finit par mentir (jalons 82 et 55).
 *
 * **Aucun défaut, et c'est voulu** : la création ne présélectionne rien. Une
 * campagne créée « par défaut en mode Alex » sans que personne l'ait choisi est
 * exactement ce qui a rendu le mode manuel invisible pendant un jalon entier.
 */

export const CAMPAIGN_MODES = ["alex", "manual"] as const;
export type CampaignMode = (typeof CAMPAIGN_MODES)[number];

/** Frontière `string` → union, au seul endroit prévu (convention du projet). */
export function toCampaignMode(raw: string): CampaignMode {
  return raw === "manual" ? "manual" : "alex";
}

/**
 * Le mode que porte une étape neuve de cette campagne.
 *
 * Les deux vocabulaires coïncident aujourd'hui ; la conversion est explicite
 * pour que l'un puisse gagner une valeur sans l'imposer à l'autre.
 */
export function stepModeFor(mode: CampaignMode): StepMode {
  return mode === "manual" ? "manual" : "alex";
}

export interface CampaignPath {
  readonly mode: CampaignMode;
  readonly title: string;
  /** Ce que la voie fait, en une phrase — jamais « ce que le champ vaut ». */
  readonly summary: string;
  /** Ce qu'on va faire juste après avoir choisi : la suite du parcours. */
  readonly next: readonly string[];
}

/**
 * Les deux voies, décrites par ce qu'elles **font** et non par leur réglage.
 *
 * « Rédigée par Alex » ne dit rien à qui découvre l'écran ; « Alex lit le site
 * du prospect et écrit chaque message » dit ce qu'on obtient et ce que ça
 * coûte. Le texte vit ici plutôt que dans l'écran parce que la page de création
 * **et** la page de la campagne le montrent : deux formulations finiraient par
 * décrire deux produits.
 */
export const CAMPAIGN_PATHS: readonly CampaignPath[] = [
  {
    mode: "alex",
    title: "Automatique (Alex)",
    summary:
      "Alex lit le site du prospect, applique l'angle de son rôle et écrit chaque message. Un appel au modèle par contact, facturé.",
    next: [
      "Vous écrivez une consigne par étape, pas le message",
      "La recherche et les notes d'angle s'appliquent",
      "« Écrire les mails » annonce le coût avant de dépenser",
    ],
  },
  {
    mode: "manual",
    title: "Manuel",
    summary:
      "Vous tapez l'objet et le message une fois. Les balises {prenom}, {societe} et {site} sont remplacées par contact, sans appel au modèle.",
    next: [
      "Vous tapez le texte de chaque étape, avec son aperçu en direct",
      "Composition instantanée et gratuite",
      "Aucune recherche : le message ne cite que ce que la fiche porte",
    ],
  },
];

/** Ce que l'écran d'une campagne affiche pour rappeler sa voie. */
export function describeCampaignMode(mode: CampaignMode): string {
  return mode === "manual"
    ? "Campagne écrite à la main : chaque étape porte son texte et ses balises."
    : "Campagne rédigée par Alex : chaque étape porte une consigne.";
}
