/**
 * **Comparer des intitulés sans deviner : la casse, les accents, la
 * ponctuation absorbés, et rien d'autre.**
 *
 * Ces deux fonctions vivaient dans `role-angles.ts` depuis le jalon 53. Elles
 * en sortent parce qu'un second lecteur d'intitulés arrive — la classification
 * en groupes de fonction — et que **deux plis différents finiraient par
 * classer la même personne dans deux cases**. Une garde statique impose
 * désormais que les deux passent par ici.
 *
 * ## Pourquoi sur les mots, jamais sur les caractères
 *
 * C'est la règle qui décide de tout : une comparaison de sous-chaînes
 * reconnaîtrait « coo » dans « coordinatrice » et « adv » dans « advertising ».
 * Une coordinatrice logistique classée en Direction, une responsable publicité
 * classée en Commercial : le message part sous le mauvais angle, et le
 * destinataire le voit avant nous.
 */

/**
 * Minuscules, sans accents, ponctuation réduite à des espaces.
 *
 * « Responsable SAV », « responsable s.a.v. » et « RESPONSABLE  SAV » donnent
 * la même clé. Le `&` d'un « Co-fondatrice & CMO » devient une espace, donc
 * deux mots, ce qui est exactement ce qu'on veut lire.
 */
export function foldLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Les mots d'un intitulé, une fois plié. */
export function labelWords(value: string): readonly string[] {
  const folded = foldLabel(value);
  return folded === "" ? [] : folded.split(" ");
}

/**
 * L'étiquette apparaît-elle comme une **suite de mots entiers** de l'intitulé ?
 *
 * « responsable sav » couvre « Responsable SAV France » ; « coo » ne couvre pas
 * « coordinatrice ». Une suite, et non un ensemble : « directeur général »
 * ne doit pas se reconnaître dans « directeur du développement général ».
 */
export function containsWords(
  haystack: readonly string[],
  needle: readonly string[],
): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let start = 0; start + needle.length <= haystack.length; start += 1) {
    if (needle.every((word, offset) => haystack[start + offset] === word)) return true;
  }
  return false;
}
