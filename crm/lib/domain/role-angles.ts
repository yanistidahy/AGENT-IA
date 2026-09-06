/**
 * **L'angle d'un rôle : ce qui compte pour la personne qui lira.**
 *
 * Une campagne qui écrit à plusieurs personnes d'une même maison ne peut pas
 * leur servir le même paragraphe. La responsable SAV mesure des tickets ; le
 * fondateur regarde la marge. Le pitch ne change pas — l'angle, si.
 *
 * Ce module ne connaît ni Prisma, ni les écrans : il reçoit les rôles tels
 * qu'ils sont réglés et une fonction telle qu'elle a été importée, et il dit
 * lequel s'applique. Tout le reste — l'écriture des notes, leur affichage —
 * vit au-dessus.
 *
 * ## Apparier sans deviner
 *
 * Les fichiers d'enrichissement disent « Head of Customer Care », « Responsable
 * service client » ou « SAV Manager » pour un même métier. On ne peut donc pas
 * comparer des chaînes brutes ; on ne peut pas non plus **deviner** qu'un
 * intitulé inconnu ressemble à un rôle connu — ce serait écrire à quelqu'un
 * sous un angle choisi par ressemblance orthographique, et c'est la faute que
 * le jalon 25 s'est interdite sur les domaines.
 *
 * D'où le partage : ce sont **les étiquettes réglées à la main** qui décident,
 * et l'appariement ne fait qu'absorber ce qui ne veut rien dire — la casse, les
 * accents, la ponctuation, les espaces. Ce qu'aucune étiquette ne reconnaît est
 * **signalé** (voir `unmatchedTitles`) pour qu'on étende la liste, jamais
 * rattaché au rôle le plus proche.
 */

/** Un rôle réglé par l'utilisateur, avec ses étiquettes et sa note d'angle. */
export interface RoleAngleLike {
  readonly id: string;
  readonly name: string;
  /** Ce que l'utilisateur a écrit : ce qui compte pour cette personne. */
  readonly angle: string;
  /** Les intitulés qui désignent ce rôle, tels qu'ils arrivent des fichiers. */
  readonly labels: readonly string[];
}

/**
 * Minuscules, sans accents, ponctuation réduite à des espaces.
 *
 * « Responsable SAV », « responsable s.a.v. » et « RESPONSABLE  SAV » donnent
 * la même clé. C'est la même discipline que `normalizeCompanyName` : la règle
 * vit en un seul endroit, et elle est vérifiable sans base.
 */
export function normalizeRoleLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Le résultat de l'appariement — jamais une supposition. */
export type RoleMatch =
  | { readonly kind: "role"; readonly role: RoleAngleLike; readonly matched: string }
  /** Aucune étiquette ne reconnaît cet intitulé, ou la fiche n'en porte pas. */
  | { readonly kind: "generic"; readonly reason: "no-title" | "no-match" | "ambiguous" };

/** Les mots de l'intitulé, une fois normalisé. */
function words(value: string): readonly string[] {
  const normalized = normalizeRoleLabel(value);
  return normalized === "" ? [] : normalized.split(" ");
}

/**
 * L'étiquette apparaît-elle comme une **suite de mots entiers** de l'intitulé ?
 *
 * Sur les mots et non sur les caractères : « ops » ne doit pas se reconnaître
 * dans « opsourcing ». C'est ce qui permet à l'étiquette « responsable sav » de
 * couvrir « Responsable SAV France » sans ouvrir la porte aux ressemblances.
 */
function containsWords(haystack: readonly string[], needle: readonly string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let start = 0; start + needle.length <= haystack.length; start += 1) {
    if (needle.every((word, offset) => haystack[start + offset] === word)) return true;
  }
  return false;
}

/**
 * Le rôle qui s'applique à cet intitulé.
 *
 * Trois passes, dans cet ordre de certitude :
 *
 * 1. **égalité** de l'intitulé normalisé avec une étiquette — le cas franc ;
 * 2. **inclusion** en mots entiers, l'étiquette la plus longue l'emportant :
 *    entre « responsable » et « responsable sav », c'est la seconde qui décrit
 *    le mieux la personne ;
 * 3. **ambiguïté** — deux rôles revendiquent l'intitulé avec des étiquettes de
 *    même longueur : on **renonce**. Choisir reviendrait à tirer au sort
 *    l'angle sous lequel on écrit à quelqu'un ; l'intitulé remonte alors dans
 *    la liste des non appariés, où une étiquette plus précise le tranchera.
 */
export function matchRole(title: string, roles: readonly RoleAngleLike[]): RoleMatch {
  const needle = normalizeRoleLabel(title);
  if (needle === "") return { kind: "generic", reason: "no-title" };

  for (const role of roles) {
    for (const label of role.labels) {
      if (normalizeRoleLabel(label) === needle) return { kind: "role", role, matched: label };
    }
  }

  const haystack = words(title);
  let best: { readonly role: RoleAngleLike; readonly label: string; readonly size: number } | null =
    null;
  let tied = false;

  for (const role of roles) {
    for (const label of role.labels) {
      const parts = words(label);
      if (!containsWords(haystack, parts)) continue;

      if (best === null || parts.length > best.size) {
        best = { role, label, size: parts.length };
        tied = false;
      } else if (parts.length === best.size && best.role.id !== role.id) {
        tied = true;
      }
    }
  }

  if (best === null) return { kind: "generic", reason: "no-match" };
  if (tied) return { kind: "generic", reason: "ambiguous" };
  return { kind: "role", role: best.role, matched: best.label };
}

/**
 * La consigne d'angle envoyée à Alex.
 *
 * **Toujours présente, y compris à la forme négative** — c'est la règle du DM
 * du jalon 48 : une absence de ligne se lit comme une absence d'information,
 * alors qu'une ligne qui dit « aucun » se lit comme une interdiction. Sans
 * elle, un modèle à qui l'on ne dit rien du rôle en invente un à partir de
 * l'intitulé, et écrit à une « Head of Customer Care » comme à une directrice
 * générale.
 */
export function roleAngleRule(match: RoleMatch): string {
  if (match.kind === "role" && match.role.angle.trim() === "") {
    // Le rôle est reconnu, mais personne n'a encore écrit ce qui compte pour
    // lui — c'est l'état des rôles semés à la migration. Le nommer sans note
    // ferait inventer la note : un modèle à qui l'on annonce « angle pour
    // Responsable SAV » puis rien remplit le vide lui-même.
    return [
      `Angle pour ce rôle : AUCUN — la fonction correspond au rôle « ${match.role.name} »,`,
      "mais aucune note d'angle n'a encore été écrite pour lui.",
      "Tiens-t'en au positionnement général et à ce que dit le dossier.",
      "N'invente pas l'angle d'un métier que tu crois deviner à son intitulé.",
    ].join("\n");
  }

  if (match.kind === "role") {
    return [
      `Angle pour ce rôle (« ${match.role.name} ») — c'est l'instruction la plus`,
      "spécifique dont tu disposes, elle l'emporte sur le ton générique :",
      "",
      match.role.angle.trim(),
    ].join("\n");
  }

  const cause =
    match.reason === "no-title"
      ? "la fiche ne porte aucune fonction"
      : match.reason === "ambiguous"
        ? "sa fonction correspond à plusieurs rôles, donc à aucun avec certitude"
        : "aucun rôle réglé ne reconnaît sa fonction";

  return [
    `Angle pour ce rôle : AUCUN — ${cause}.`,
    "Tiens-t'en au positionnement général et à ce que dit le dossier.",
    "N'invente pas l'angle d'un métier que tu crois deviner à son intitulé.",
  ].join("\n");
}

/** Un intitulé qu'aucun rôle ne reconnaît, avec le nombre de fiches qui le portent. */
export interface UnmatchedTitle {
  readonly title: string;
  readonly contacts: number;
  /** Pourquoi il n'est pas apparié — « ambiguous » demande une étiquette plus précise. */
  readonly reason: "no-match" | "ambiguous";
}

/**
 * Les intitulés présents en base qu'aucun rôle ne reconnaît, les plus portés
 * d'abord : c'est la liste de travail pour étendre les étiquettes, et elle dit
 * combien de personnes chaque ligne représente.
 *
 * Les fiches **sans fonction** n'y figurent pas : il n'y a pas d'étiquette à
 * ajouter pour une information absente — c'est une donnée à saisir, pas un
 * réglage à étendre.
 */
export function unmatchedTitles(
  titles: readonly { readonly title: string; readonly contacts: number }[],
  roles: readonly RoleAngleLike[],
): readonly UnmatchedTitle[] {
  const out: UnmatchedTitle[] = [];

  for (const entry of titles) {
    if (normalizeRoleLabel(entry.title) === "") continue;
    const match = matchRole(entry.title, roles);
    if (match.kind === "role") continue;
    if (match.reason === "no-title") continue;
    out.push({ title: entry.title, contacts: entry.contacts, reason: match.reason });
  }

  return out.sort((a, b) => b.contacts - a.contacts || a.title.localeCompare(b.title, "fr"));
}
