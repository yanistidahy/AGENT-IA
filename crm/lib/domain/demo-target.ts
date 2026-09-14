import { externalLabel } from "./links";

/**
 * **Ce que la phrase de démonstration doit nommer.**
 *
 * « J'ai préparé une démonstration de ce que cela donnerait sur votre site »
 * est une promesse ; « … sur cuure.com » est une preuve. La différence entre
 * les deux est ce qui distingue un message écrit pour quelqu'un d'un gabarit
 * envoyé à cinquante personnes, et c'est un fait qui doit venir de la base,
 * jamais du modèle.
 *
 * ## Trois sources, dans cet ordre, et un repli qui n'invente rien
 *
 * 1. le **site du contact** (`Contact.website`), le plus précis ;
 * 2. à défaut, le **domaine de la société** (`Company.domain`) ;
 * 3. à défaut, **le nom de la marque**.
 *
 * Le troisième cas est le plus important des trois. Sans lui, un modèle à qui
 * l'on demande de citer un site alors qu'on ne lui en donne aucun **en
 * fabrique un**, `maisonvertu.fr` a toutes les chances d'exister et
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
    // ici plutôt que là-bas, cette fonction sert tout l'affichage du produit,
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
    return `**Le site à citer est \`${target.value}\`.** Écris la phrase de démonstration en le nommant tel quel, « ce que cela donnerait sur ${target.value} ». N'écris aucune autre adresse, et ne l'enjolive pas.`;
  }
  if (target.kind === "brand") {
    return `**Aucun site n'est connu pour ce contact.** Ne cite donc **aucune adresse**, n'en déduis pas une du nom de la marque, elle appartiendrait probablement à quelqu'un d'autre. Nomme la boutique à la place : « ce que cela donnerait sur votre boutique ${target.value} ».`;
  }
  return `**Aucun site ni nom de marque n'est connu.** N'invente ni adresse ni nom : écris simplement « sur votre boutique ».`;
}

/**
 * Ce que la file affiche pour dire **ce qu'Alex avait sous la main**.
 *
 * Trois états, trois gestes différents : un site connu se cite, une marque
 * seule se nomme, et « ni l'un ni l'autre » n'est pas un défaut du modèle mais
 * une fiche à compléter. Les confondre coûte un aller-retour entier.
 */
export function describeDemoSource(target: DemoTarget): string {
  if (target.kind === "site") return `site ${target.value}`;
  if (target.kind === "brand") return `aucun site, marque « ${target.value} »`;
  return "ni site ni société liée";
}

/** Ce que l'objet doit nommer quand un objet générique ne le nomme pas. */
export const GENERIC_SUBJECT_TARGETS = ["votre boutique", "votre site", "votre marque"];

/**
 * **L'objet nomme la marque**, et c'est une consigne qui manquait.
 *
 * Le prompt décrivait le corps ligne à ligne et ne disait **rien** de l'objet :
 * il n'était demandé qu'à la toute fin, comme une clé du JSON attendu. Le
 * modèle retombait donc sur la formule générique de la consigne la plus proche,
 * « votre boutique », ce que le mail de référence ne fait jamais.
 *
 * Un objet qui nomme la marque se distingue dans une boîte de réception : il
 * dit que le message a été écrit pour ce destinataire, avant même d'être
 * ouvert. C'est le même argument que la phrase de démonstration, un cran plus
 * tôt.
 */
export function subjectRule(brand: string): string {
  const name = brand.trim();
  if (name === "") {
    return `**L'objet ne peut nommer aucune marque** : la fiche n'en porte pas. N'en invente pas, reste factuel et court.`;
  }
  return `**L'objet nomme la marque**, comme le mail de référence : « Une démonstration préparée pour ${name} ». Jamais « votre boutique » ni « votre site » dans l'objet, une formule générique se lit comme un envoi en masse avant même d'être ouverte.`;
}

/**
 * La garantie qui va avec la consigne.
 *
 * Même posture que la signature (jalon 33) et que le tiret long (jalon 58) :
 * une consigne de prompt est une intention, et « presque toujours » ne suffit
 * pas pour la seule ligne que le destinataire lit avant de décider d'ouvrir.
 *
 * Le remplacement est **étroit** : il ne touche que les formules génériques
 * énumérées ci-dessus, et seulement quand la marque est connue. Un objet qui
 * nomme déjà la marque, ou qui parle d'autre chose (une relance, un rappel de
 * rendez-vous), n'est pas réécrit.
 */
export function enforceSubjectBrand(subject: string, brand: string): string {
  const name = brand.trim();
  if (name === "" || subject.toLowerCase().includes(name.toLowerCase())) return subject;

  let out = subject;
  for (const generic of GENERIC_SUBJECT_TARGETS) {
    out = out.replace(new RegExp(generic, "gi"), name);
  }
  return out;
}
