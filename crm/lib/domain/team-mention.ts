/**
 * **Ne jamais supposer une équipe.**
 *
 * « Votre équipe doit certainement gérer un volume important de questions
 * récurrentes » se lit faux à une marque de trois personnes, et la moitié du
 * vivier en est une. Le prospect sait qu'il n'a pas d'équipe : la phrase le lui
 * rappelle, et le message est mort à la première ligne. L'erreur n'est pas
 * symétrique, écrire à une grande marque sans mentionner son équipe ne coûte
 * rien, l'inverse coûte le prospect.
 *
 * ## Ce qui autorise la mention, et ce qui ne l'autorise pas
 *
 * **Seule une affirmation écrite à la main dans la note pour Alex l'autorise.**
 * Ni la taille portée par la fiche société, ni une déduction du modèle : la
 * première est un champ libre rempli au fil de l'eau, et rien ne garantit
 * qu'elle décrive encore l'entreprise ; la seconde est exactement le pari qu'on
 * refuse. La taille reste **dite** au modèle comme un fait du dossier, elle ne
 * commande rien.
 *
 * C'est la même règle que le DM du jalon 48 et l'angle de rôle du jalon 53 : la
 * consigne est émise **dans les deux sens**, y compris et surtout à la forme
 * négative. Une absence de ligne se lit comme une absence d'information ; une
 * ligne qui dit « non » se lit comme une règle.
 */

/** La formulation par défaut : celle qui ne suppose rien. */
export const NO_TEAM_RULE = `**N'évoque ni équipe, ni volume, ni échelle.** Tu ne sais pas combien de
personnes travaillent chez ce prospect, et la plupart de nos cibles sont de
petites marques où le fondateur répond lui-même. Écrire « votre équipe doit
gérer un volume important de questions » à quelqu'un qui n'a pas d'équipe est la
faute qui tue un message à la première ligne.

Nomme la douleur autrement : la **répétition** des mêmes questions d'un visiteur
à l'autre, composition, délais, choix du produit, et le fait que chacune
demande une réponse. C'est vrai que le prospect soit seul ou à cinquante, et
c'est vérifiable de son côté.

Interdits explicites : « votre équipe », « vos équipes », « votre service
client », « un volume important », « à grande échelle », et toute variante qui
présume du personnel ou du trafic.`;

/** Ce qui est permis quand la note l'affirme, et à cette condition seulement. */
export const TEAM_ALLOWED_RULE = `**La note écrite à la main affirme que ce prospect a une équipe qui traite les
demandes.** Tu peux donc parler de son équipe et du volume qu'elle absorbe, c'est un fait qu'on nous a donné, pas une supposition.

Reste précis : reprends ce que la note dit, n'ajoute pas d'échelle qu'elle
n'affirme pas.`;

/**
 * Reconnaît une autorisation **explicite** dans la note écrite à la main.
 *
 * Volontairement étroite : deux mots-clés qui ne peuvent pas apparaître par
 * hasard dans une note de prospection. Une reconnaissance large finirait par
 * autoriser la mention sur une note qui parle d'autre chose, « j'ai vu leur
 * équipe au salon » n'affirme rien sur le service client.
 */
export function noteAllowsTeam(alexNote: string): boolean {
  const text = alexNote.toLowerCase();
  return (
    text.includes("a une équipe") ||
    text.includes("a une equipe") ||
    text.includes("équipe dédiée") ||
    text.includes("equipe dediee") ||
    text.includes("équipe support") ||
    text.includes("marque établie") ||
    text.includes("marque etablie")
  );
}

/** La consigne, toujours émise, dans un sens ou dans l'autre. */
export function teamMentionRule(alexNote: string): string {
  return noteAllowsTeam(alexNote) ? TEAM_ALLOWED_RULE : NO_TEAM_RULE;
}

/**
 * La taille telle que la fiche la porte, **un fait, pas une permission**.
 *
 * Rendue dans les deux cas, comme le DM : « NON RENSEIGNÉE » est une
 * information, et c'est même la plus fréquente aujourd'hui.
 */
export function sizeFact(size: string): string {
  const clean = size.trim();
  return clean === ""
    ? "Taille de la société : NON RENSEIGNÉE, n'en déduis rien, et surtout pas une équipe."
    : `Taille de la société, telle que la fiche la porte : ${clean.slice(0, 120)} (fait indicatif : il n'autorise pas à parler d'équipe, seule la note écrite à la main le fait).`;
}
