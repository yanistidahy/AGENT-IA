/**
 * **Un départ vide, et un départ périmé.** Deux façons pour une carte de la file
 * de promettre autre chose que ce qui partira.
 *
 * ## 1 · Vide
 *
 * « Vide » n'est pas « la chaîne est vide » : le corps d'un départ porte
 * **toujours** la signature, imposée à la composition (jalon 33). Un brouillon
 * composé depuis une étape sans texte rend donc « Yanis Tidahy / Fondateur /
 * 07 … » — trois lignes, non vides, et le contrôle de `sendEmailToContact` les
 * accepte. Mesuré avant ce jalon : un tel départ **est réellement parti**, et le
 * destinataire a reçu une signature seule.
 *
 * Le contrôle retire donc la signature **avant** de juger. Il vit ici, pur, pour
 * que le clic humain et l'ordonnanceur le partagent par construction : une garde
 * statique vérifie qu'ils ne cessent pas de passer par le même `sendDeparture`.
 *
 * ## 2 · Périmé
 *
 * Un départ est composé à un instant, depuis un gabarit. Écrire ensuite le texte
 * de l'étape ne le recompose pas — c'est la décision du jalon 70, « Enregistrer
 * configure, « Écrire les mails » dépense », et elle est juste : un
 * enregistrement ne doit ni facturer ni écraser un brouillon qu'on relit.
 *
 * Mais rien ne le **disait**, et c'est ce qui produisait la contradiction
 * signalée : la carte rendait le corps composé *et* un avertissement « phrase
 * retirée » calculé sur le gabarit d'aujourd'hui. Les deux parlaient de deux
 * textes différents, au même endroit, sans que rien ne l'indique.
 *
 * L'empreinte règle la question en un octet de comparaison : **un avertissement
 * de carte doit décrire ce qui partira**, donc quand le gabarit a bougé, on le
 * dit et on propose de réécrire, plutôt que d'annoncer une phrase retirée d'un
 * texte que ce départ ne porte pas.
 */

/** La forme minimale d'un gabarit d'étape, telle que l'empreinte la lit. */
export interface TemplateShape {
  readonly mode: string;
  readonly subject: string;
  readonly body: string;
  readonly variants: readonly {
    readonly group: string;
    readonly subject: string;
    readonly body: string;
  }[];
}

/**
 * L'empreinte du gabarit dont un départ a été composé.
 *
 * **Le texte entier, pas un condensé.** Un hachage aurait été plus court et
 * aurait demandé une dépendance de plus pour comparer deux chaînes ; ici la
 * valeur est lisible en base, ce qui rend un diagnostic possible sans rejouer
 * quoi que ce soit — et c'est exactement ce qui a manqué pour comprendre la
 * carte signalée.
 *
 * Les variantes sont **triées par groupe** : deux enregistrements qui les
 * rendent dans un ordre différent décrivent le même gabarit, et faire dépendre
 * l'empreinte de l'ordre de lecture ferait passer pour périmés des départs qui
 * ne le sont pas. Le séparateur est un caractère qu'aucun texte ne porte.
 */
export function templateFingerprint(step: TemplateShape): string {
  const parts = [step.mode, step.subject, step.body];
  for (const variant of [...step.variants].sort((a, b) => a.group.localeCompare(b.group))) {
    parts.push(variant.group, variant.subject, variant.body);
  }
  return parts.join("\u0001");
}

/**
 * Ce départ a-t-il été composé depuis le gabarit courant ?
 *
 * **Une empreinte vide n'est pas « périmé ».** Tous les départs composés avant
 * ce jalon en portent une, et les déclarer périmés d'office allumerait un
 * avertissement sur toute la file au premier déploiement — une alerte qui sonne
 * partout est une alerte qu'on apprend à ignorer (jalon 62). Ils sont donc
 * traités comme « on ne sait pas », c'est-à-dire silencieux.
 */
export function isStaleDeparture(stored: string, current: string): boolean {
  if (stored === "") return false;
  return stored !== current;
}

/**
 * Le corps **sans la signature**, pour juger de ce qu'il dit réellement.
 *
 * Le retrait est ancré en **fin de texte** et sur les blocs *connus*
 * (`knownSignatureBlocks`, jalon 66) : couper « les trois dernières lignes »
 * mutilerait un message terminé par un post-scriptum, et c'est la même prudence
 * que `replaceSignature`.
 */
export function bodyWithoutSignature(body: string, blocks: readonly string[]): string {
  let text = body.trim();
  // Plusieurs passes : un départ composé avant le jalon 67 peut porter deux
  // signatures l'une sous l'autre, et n'en retirer qu'une le laisserait paraître
  // rempli alors qu'il ne dit rien.
  let changed = true;
  while (changed) {
    changed = false;
    for (const block of blocks) {
      const trimmed = block.trim();
      if (trimmed === "") continue;
      if (text.endsWith(trimmed)) {
        text = text.slice(0, text.length - trimmed.length).trim();
        changed = true;
      }
    }
  }
  return text;
}

/**
 * Pourquoi ce départ est vide, ou `null` quand il a de quoi partir.
 *
 * Deux raisons distinctes, parce qu'elles ne se corrigent pas au même endroit :
 * un objet manquant se règle sur l'étape ou la variante, un corps manquant sur
 * le texte lui-même. Une phrase unique ferait chercher.
 */
export function emptyDepartureReason(
  departure: { readonly subject: string; readonly body: string },
  signatureBlocks: readonly string[],
): string | null {
  const subject = departure.subject.trim();
  const body = bodyWithoutSignature(departure.body, signatureBlocks);

  if (subject === "" && body === "") {
    return "ni objet ni message : il ne reste que votre signature";
  }
  if (subject === "") return "aucun objet";
  if (body === "") return "aucun message : il ne reste que votre signature";
  return null;
}

/** Le refus rendu à l'envoi, et la phrase de la carte. Une seule formulation. */
export function emptyDepartureRefusal(reason: string): string {
  return `Ce départ est vide (${reason}) : rien n'est parti. Écrivez le texte de l'étape, puis réécrivez ce départ.`;
}

/**
 * ## 3 · Resynchroniser, et ce que le compte rendu doit dire
 *
 * Enregistrer une séquence ne recomposait rien depuis le jalon 70, et la raison
 * tenait : un enregistrement ne doit ni facturer ni écraser un brouillon qu'on
 * relit. Mais elle vaut pour une étape **rédigée par Alex**, dont chaque
 * brouillon est un appel au modèle. Une étape **écrite à la main** ne coûte
 * rien : son rendu est une substitution de trois balises, et laisser la file
 * porter le texte d'avant l'enregistrement n'est alors pas une précaution,
 * c'est un écran qui promet autre chose que ce qui partira.
 *
 * Le compte rendu porte **trois nombres distincts** parce qu'ils n'engagent pas
 * la même chose : ce qui a été remis à jour, ce qui a été créé pour quelqu'un
 * qui n'avait rien, et ce qui a été **conservé** faute d'avoir le droit d'être
 * écrasé. Un total unique laisserait croire que tout a suivi.
 */
export interface ResyncReport {
  /** Départs en attente réécrits depuis le gabarit courant. */
  readonly updated: number;
  /** Départs créés pour des inscrits dus qui n'en avaient aucun. */
  readonly created: number;
  /** Retouchés à la main, donc laissés tels quels, avec leur marqueur. */
  readonly kept: number;
  /** Ce qui a empêché la création (week-end, campagne en pause). Vide sinon. */
  readonly blocked: string | null;
}

const plural = (count: number) => (count > 1 ? "s" : "");

/**
 * La phrase du compte rendu, composée ici pour n'exister qu'une fois.
 *
 * Elle nomme **pourquoi** un départ a été conservé — « retouché à la main » —
 * plutôt que de le compter à part en silence : c'est le seul des trois nombres
 * qui décrit une décision de l'utilisateur, et celui qu'il faut pouvoir
 * contester.
 */
export function describeResync(report: ResyncReport): string {
  const parts = [
    `${report.updated} départ${plural(report.updated)} mis à jour`,
    `${report.created} créé${plural(report.created)}`,
  ];
  if (report.kept > 0) {
    parts.push(`${report.kept} conservé${plural(report.kept)} (retouché${plural(report.kept)} à la main)`);
  }
  const line = parts.join(" · ");
  return report.blocked === null ? line : `${line}. ${report.blocked}`;
}

/** Y a-t-il quelque chose à dire ? Un enregistrement sans file reste muet. */
export function hasResyncNews(report: ResyncReport): boolean {
  return report.updated > 0 || report.created > 0 || report.kept > 0;
}
