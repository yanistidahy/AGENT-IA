/**
 * Supprimer une campagne qui a déjà envoyé — pur, testé.
 *
 * Le jalon 55 avait tranché : un envoi interdit la suppression, point final.
 * C'était juste pour empêcher un clic distrait d'effacer des faits sans le
 * savoir. Ce n'est plus la seule volonté possible — on peut vouloir reprendre
 * une campagne en main, quitte à perdre ses chiffres. Le refus devient donc un
 * **second geste**, délibéré, plutôt qu'une porte fermée.
 *
 * Deux fonctions, et rien d'autre : composer le texte qui dit exactement ce
 * qui part, et vérifier que le nom tapé est bien celui de la campagne. Les deux
 * sont pures parce qu'elles sont réutilisées **des deux côtés** — l'écran les
 * affiche, le serveur les revérifie au moment d'écrire. Une seule définition,
 * comme partout ailleurs dans ce projet où une même règle sert deux surfaces.
 */

/** Ce qui disparaît des statistiques si la campagne est supprimée. */
export interface HistoryLoss {
  readonly messages: number;
  readonly opens: number;
  readonly replies: number;
}

function plural(count: number): string {
  return count > 1 ? "s" : "";
}

/**
 * La phrase qui dit exactement ce qui part avec la campagne.
 *
 * **Volontairement littérale** — pas « êtes-vous sûr ? », qui ne dit rien de
 * ce qu'on perd. Les trois nombres viennent de l'entonnoir déjà affiché sur la
 * carte : ce que l'écran promet de supprimer est ce que l'écran montrait la
 * seconde d'avant, pas un second calcul qui pourrait diverger.
 *
 * Les contacts ne sont **pas** mentionnés comme perdant quoi que ce soit — la
 * phrase le dit en toutes lettres, parce que c'est la première question que
 * pose quiconque supprime un conteneur qui a touché des gens.
 */
export function historyLossWarning(loss: HistoryLoss): string {
  return (
    `${loss.messages} message${plural(loss.messages)} envoyé${plural(loss.messages)}, ` +
    `${loss.opens} ouverture${plural(loss.opens)}, ` +
    `${loss.replies} réponse${plural(loss.replies)} seront retirés de vos statistiques. ` +
    "Les contacts et leur historique de conversation restent intacts — seule l'attribution " +
    "à cette campagne disparaît."
  );
}

/**
 * Le nom tapé confirme-t-il la suppression ?
 *
 * **Correspondance exacte**, espaces de bord mis à part — ni casse ni accents
 * assouplis. C'est la friction demandée : taper « prospection sav » pour
 * confirmer « Prospection SAV » ne devrait pas suffire, sinon la saisie
 * n'engage à rien de plus qu'un clic. Une chaîne vide ne confirme jamais rien,
 * même si le nom de la campagne l'est aussi (un nom ne peut pas être vide —
 * `createCampaignSchema` l'interdit déjà).
 */
export function nameConfirms(typed: string, name: string): boolean {
  const trimmed = typed.trim();
  return trimmed !== "" && trimmed === name.trim();
}
