/**
 * Le compte Instagram d'une marque, saisi comme on l'a sous la main.
 *
 * Le champ reçoit ce qu'on copie : un pseudo (« @maison_vertu »), un pseudo nu
 * (« maison_vertu »), ou l'URL entière collée depuis le navigateur. Les trois
 * désignent le même profil et doivent tous produire un lien.
 *
 * **La valeur stockée n'est jamais réécrite** — c'est la règle des liens du
 * jalon 10 : normaliser en base rendrait l'export infidèle à la source, et un
 * aller-retour tableur → CRM → tableur modifierait le fichier de l'utilisateur
 * sans qu'il l'ait demandé. La normalisation a lieu **au rendu**, ici.
 */

/** Ce qui peut composer un pseudo Instagram : lettres, chiffres, point, tiret bas. */
const HANDLE = /^[A-Za-z0-9._]{1,30}$/;

/**
 * Le pseudo, extrait de n'importe laquelle des formes acceptées.
 *
 * `null` quand rien d'exploitable n'en sort — et le point important est que
 * l'appelant doit alors **ne rien rendre de cliquable**, plutôt que fabriquer
 * une adresse : un lien mort dans une fiche est pire qu'un champ vide, parce
 * qu'on le suit.
 */
export function instagramHandle(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;

  // Une URL, complète ou non : on ne garde que le premier segment du chemin.
  // `instagram.com/maison_vertu/reels` désigne toujours le même compte.
  const asUrl = trimmed
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "");
  if (/^instagram\.com\//i.test(asUrl)) {
    const segment = asUrl.slice("instagram.com/".length).split(/[/?#]/)[0] ?? "";
    return HANDLE.test(segment) ? segment : null;
  }

  // Un pseudo, avec ou sans arobase.
  const handle = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  return HANDLE.test(handle) ? handle : null;
}

/** L'adresse du profil, ou `null` si la valeur ne désigne pas un compte. */
export function instagramUrl(value: string): string | null {
  const handle = instagramHandle(value);
  return handle === null ? null : `https://instagram.com/${handle}`;
}

/** Ce qu'on affiche : le pseudo précédé de son arobase. */
export function instagramLabel(value: string): string | null {
  const handle = instagramHandle(value);
  return handle === null ? null : `@${handle}`;
}
