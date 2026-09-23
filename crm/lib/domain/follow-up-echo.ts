import { fold } from "./text";

/**
 * **Une relance qui recopie le premier message se voit avant de partir.**
 *
 * La consigne le demande, et les consignes tiennent presque toujours. « Presque »
 * ne suffit pas ici : un prospect qui reçoit deux fois le même paragraphe ne
 * s'en plaint pas, il cesse de lire, et on ne l'apprend jamais. Même posture
 * que la signature (jalon 33) et le tiret long (jalon 58) : on demande dans le
 * prompt, **et** on vérifie au retour.
 *
 * Elle **ne réécrit rien** : un remplacement automatique dans un texte
 * commercial ferait plus de dégâts qu'il n'en répare. Elle signale sur la
 * carte, avant l'envoi.
 */

/** Longueur d'une suite de mots partagée qui ne peut plus être un hasard. */
export const ECHO_RUN = 8;

/**
 * Les mots comparables d'un corps de message.
 *
 * **La salutation et le bloc de signature sont retirés** : ils sont identiques
 * d'un message à l'autre par construction, et les compter ferait sonner la
 * garde sur chaque relance sans rien apprendre.
 */
export function comparableWords(body: string): string[] {
  const lines = body.split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    // La salutation : « Bonjour Stéphanie, », « Bonjour, ».
    if (/^bonjour\b/i.test(trimmed)) continue;
    // Les formules de clôture et ce qui suit : c'est la signature.
    if (/^(à bientôt|bien à vous|cordialement|bonne continuation)/i.test(trimmed)) break;
    kept.push(trimmed);
  }
  return fold(kept.join(" "))
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word !== "");
}

/**
 * L'ouverture, repliée — pour comparer deux entrées en matière.
 *
 * Les douze premiers mots utiles plutôt que « la première phrase » : la
 * ponctuation disparaît au pliage, et une fenêtre fixe compare la même chose
 * des deux côtés même quand l'un des deux messages coupe ses phrases
 * autrement.
 */
export function openingSentence(body: string): string {
  return comparableWords(body).slice(0, 12).join(" ");
}

export interface EchoVerdict {
  /** Les deux messages ouvrent de la même façon. */
  readonly sameOpening: boolean;
  /** La plus longue suite de mots partagée, si elle atteint le seuil. */
  readonly run: string;
}

/**
 * Ce que la relance reprend du message précédent.
 *
 * Deux déclencheurs, et ils ne disent pas la même chose : une **ouverture
 * identique** est le signe qu'Alex a refait le premier message ; une **suite
 * de mots** partagée est une phrase recopiée, souvent celle de la
 * démonstration. Les deux méritent d'être signalées, séparément.
 */
export function echoOf(previous: string, draft: string, run = ECHO_RUN): EchoVerdict {
  const before = comparableWords(previous);
  const after = comparableWords(draft);
  if (before.length === 0 || after.length === 0) return { sameOpening: false, run: "" };

  const sameOpening = openingSentence(previous) === openingSentence(draft);

  // Table des suites du message précédent, de longueur `run` : on cherche la
  // première du brouillon qui s'y trouve. Linéaire, et il n'y a jamais plus de
  // quelques centaines de mots.
  const seen = new Map<string, number>();
  for (let index = 0; index + run <= before.length; index += 1) {
    seen.set(before.slice(index, index + run).join(" "), index);
  }

  for (let index = 0; index + run <= after.length; index += 1) {
    const key = after.slice(index, index + run).join(" ");
    const at = seen.get(key);
    if (at === undefined) continue;
    // Étendre tant que les deux textes coïncident : la garde nomme la suite
    // entière, pas ses huit premiers mots.
    let length = run;
    while (
      index + length < after.length &&
      at + length < before.length &&
      after[index + length] === before[at + length]
    ) {
      length += 1;
    }
    return { sameOpening, run: after.slice(index, index + length).join(" ") };
  }

  return { sameOpening, run: "" };
}

/** La phrase affichée sur la carte, ou vide quand il n'y a rien à dire. */
export function describeEcho(verdict: EchoVerdict): string {
  const parts: string[] = [];
  if (verdict.sameOpening) parts.push("elle ouvre comme le message précédent");
  if (verdict.run !== "") parts.push(`elle en reprend « ${verdict.run} »`);
  if (parts.length === 0) return "";
  return `Cette relance répète le premier message : ${parts.join(", ")}.`;
}
