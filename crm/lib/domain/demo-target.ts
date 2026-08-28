import { externalLabel } from "./links";

/**
 * **Ce que la phrase de démonstration doit nommer.**
 *
 * « J'ai préparé une démonstration de ce que cela donnerait sur votre site »
 * est une promesse ; « … sur cuure.com » est une preuve. La différence entre
 * les deux est ce qui distingue un message écrit pour quelqu'un d'un gabarit
 * envoyé à cinquante personnes — et c'est un fait qui doit venir de la base,
 * jamais du modèle.
 *
 * ## Trois sources, dans cet ordre, et un repli qui n'invente rien
 *
 * 1. le **site du contact** (`Contact.website`) — le plus précis ;
 * 2. à défaut, le **domaine de la société** (`Company.domain`) ;
 * 3. à défaut, **le nom de la marque**.
 *
 * Le troisième cas est le plus important des trois. Sans lui, un modèle à qui
 * l'on demande de citer un site alors qu'on ne lui en donne aucun **en
 * fabrique un** — `maisonvertu.fr` a toutes les chances d'exister et
 * d'appartenir à quelqu'un d'autre. Le prospect clique, tombe ailleurs, et le
 * premier contact est mort. Nommer la marque (« ce que cela donnerait sur votre
 * boutique Maison Vertu ») reste concret sans rien affirmer de faux.
 *
 * `kind` accompagne la valeur pour que la consigne de rédaction puisse dire
 * *deux choses différentes* selon le cas, plutôt qu'une phrase qui marche à
 * moitié dans les deux.
 */
export type DemoTargetKind = "site" | "brand" | "none";

export interface DemoTarget {
  readonly kind: DemoTargetKind;
  /** Le domaine à citer, ou le nom de la marque. Vide seulement si `none`. */
  readonly value: string;
}

export interface DemoTargetInput {
  readonly website: string;
  readonly companyDomain: string;
  readonly companyName: string;
}

export function demoTarget(input: DemoTargetInput): DemoTarget {
  // `externalLabel` retire le schéma et le `www.` : on cite « cuure.com », pas
  // « https://cuure.com/ », qui se lit comme un copier-coller.
  const site = firstDomain([input.website, input.companyDomain]);
  if (site !== null) return { kind: "site", value: site };

  const brand = input.companyName.trim();
  if (brand !== "") return { kind: "brand", value: brand };

  return { kind: "none", value: "" };
}

function firstDomain(candidates: readonly string[]): string | null {
  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (trimmed === "") continue;
    // `externalLabel` retire le schéma et le slash final ; le `www.` se retire
    // ici plutôt que là-bas — cette fonction sert tout l'affichage du produit,
    // et « www.cuure.com » y est une valeur légitime. Dans une phrase écrite à
    // la main, il fait copier-coller.
    const label = externalLabel(trimmed).replace(/^www\./i, "").trim();
    // Un « site » qui ne contient pas de point n'en est pas un : c'est le cas
    // des 59 fiches du jalon 24 dont la colonne SITE portait « Shopify » ou un
    // titre de page. Les citer comme une adresse serait exactement le mensonge
    // qu'on cherche à éviter.
    if (label !== "" && label.includes(".") && !label.includes(" ")) return label;
  }
  return null;
}

/**
 * La consigne donnée à Alex, adaptée à ce que la base sait réellement.
 *
 * Elle est **construite depuis la donnée** plutôt que laissée au jugement du
 * modèle : « cite leur site s'il y en a un » invite à en trouver un.
 */
export function demoTargetRule(target: DemoTarget): string {
  if (target.kind === "site") {
    return `**Le site à citer est \`${target.value}\`.** Écris la phrase de démonstration en le nommant tel quel — « ce que cela donnerait sur ${target.value} ». N'écris aucune autre adresse, et ne l'enjolive pas.`;
  }
  if (target.kind === "brand") {
    return `**Aucun site n'est connu pour ce contact.** Ne cite donc **aucune adresse** — n'en déduis pas une du nom de la marque, elle appartiendrait probablement à quelqu'un d'autre. Nomme la boutique à la place : « ce que cela donnerait sur votre boutique ${target.value} ».`;
  }
  return `**Aucun site ni nom de marque n'est connu.** N'invente ni adresse ni nom : écris simplement « sur votre boutique ».`;
}
