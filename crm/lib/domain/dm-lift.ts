import { rate, type Rate } from "./email-stats";
import { median } from "./prospecting";

/**
 * **Le DM avant l'email change-t-il quelque chose ?**
 *
 * C'est la seule question qui décide de la nouvelle approche. Sans elle, on
 * change de stratégie à l'aveugle : le sentiment que « ça marche mieux » suit
 * toujours l'effort qu'on vient d'y mettre.
 *
 * ## Ce qui est comparé, et pourquoi c'est cette borne-là
 *
 * On partage les personnes **à qui l'on a écrit un email** en deux groupes :
 * celles dont un DM Instagram précède le **premier** email, et les autres. Puis
 * on compare leur taux de réponse.
 *
 * La borne est le premier email et non le dernier : ce qu'on teste, c'est
 * l'effet d'une prise de contact préalable sur l'accueil réservé au message.
 * Un DM envoyé *après* coup n'a rien préparé — il appartient à l'autre groupe,
 * et le compter comme un DM préalable ferait dire à la mesure l'inverse de ce
 * qu'elle prétend mesurer.
 *
 * ## Ce que la comparaison ne dit pas, et que l'écran doit dire
 *
 * Ce n'est **pas une expérience contrôlée**. Les marques qu'on approche en DM
 * ne sont pas tirées au sort : ce sont celles dont on a trouvé le compte, donc
 * souvent les plus visibles, les plus actives, parfois les plus grosses. Un
 * écart en faveur du DM peut venir du canal comme de la sélection. La mesure
 * sert à décider de continuer ou d'arrêter, pas à prouver une causalité — et
 * l'écran le dit, comme il dit ce que vaut le taux d'ouverture depuis le
 * jalon 43.
 */
export interface DmLiftRow {
  /** Une personne à qui au moins un email a été envoyé. */
  readonly contactId: string;
  readonly firstEmailAt: Date;
  /** DM Instagram le plus récent **antérieur** au premier email, s'il existe. */
  readonly dmBeforeAt: Date | null;
  /** Réponse consignée après le premier email, s'il y en a une. */
  readonly repliedAt: Date | null;
}

export interface DmLiftGroup {
  readonly people: number;
  readonly replies: number;
  readonly rate: Rate;
}

export interface DmLift {
  readonly withDm: DmLiftGroup;
  readonly withoutDm: DmLiftGroup;
  /**
   * Écart en points de pourcentage, `null` si l'un des deux taux n'existe pas.
   * Jamais calculé contre un dénominateur vide — c'est la règle du jalon 20.
   */
  readonly deltaPoints: number | null;
  /** Délai médian entre le DM et la réponse, en jours. `null` sans réponse. */
  readonly delayDays: number | null;
  /** Personnes écrites, tous groupes confondus. Le socle de la lecture. */
  readonly total: number;
}

function group(rows: readonly DmLiftRow[]): DmLiftGroup {
  const replies = rows.filter((row) => row.repliedAt !== null).length;
  return { people: rows.length, replies, rate: rate(replies, rows.length) };
}

export function dmLift(rows: readonly DmLiftRow[]): DmLift {
  const withDm = rows.filter((row) => row.dmBeforeAt !== null);
  const withoutDm = rows.filter((row) => row.dmBeforeAt === null);

  const a = group(withDm);
  const b = group(withoutDm);

  const deltaPoints =
    a.rate.value === null || b.rate.value === null
      ? null
      : Math.round((a.rate.value - b.rate.value) * 100);

  // Médiane et non moyenne : une réponse arrivée six mois après le DM tirerait
  // la moyenne au point de ne plus décrire aucun des cas — même raison qu'au
  // jalon 22 pour le délai avant premier contact.
  const delays = withDm
    .filter((row) => row.repliedAt !== null)
    .map((row) => daysBetween(row.dmBeforeAt as Date, row.repliedAt as Date))
    .filter((days) => days >= 0);

  return {
    withDm: a,
    withoutDm: b,
    deltaPoints,
    delayDays: median(delays),
    total: rows.length,
  };
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * La phrase de lecture, écrite une fois pour les deux écrans.
 *
 * Elle **refuse de conclure** tant que les groupes sont trop petits : à trois
 * personnes d'un côté et deux de l'autre, un écart de trente points ne veut
 * rien dire, et l'afficher comme un résultat conduirait à changer de stratégie
 * sur du bruit.
 */
export const MIN_GROUP = 5;

export function describeLift(lift: DmLift): string {
  if (lift.total === 0) {
    return "Aucun email envoyé sur la période : il n'y a rien à comparer.";
  }
  if (lift.withDm.people === 0) {
    return "Aucune personne écrite n'avait reçu de DM auparavant. Consignez vos DM avec le type « Instagram » pour que la comparaison existe.";
  }
  if (lift.withDm.people < MIN_GROUP || lift.withoutDm.people < MIN_GROUP) {
    return `Trop peu de monde pour conclure : ${lift.withDm.people} avec DM, ${lift.withoutDm.people} sans. À partir de ${MIN_GROUP} de chaque côté, l'écart commence à vouloir dire quelque chose.`;
  }
  if (lift.deltaPoints === null) return "Comparaison indisponible.";
  if (lift.deltaPoints === 0) {
    return "Même taux de réponse avec et sans DM préalable, sur cette période.";
  }
  const better = lift.deltaPoints > 0;
  return `${Math.abs(lift.deltaPoints)} points de ${better ? "plus" : "moins"} avec un DM préalable. Les deux groupes ne sont pas tirés au sort : l'écart peut venir du canal comme du choix des marques approchées.`;
}
