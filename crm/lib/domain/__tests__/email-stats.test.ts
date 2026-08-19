import { describe, expect, it } from "vitest";
import {
  byDay,
  byWeek,
  formatRate,
  OPEN_RATE_CAVEAT,
  OPEN_RATE_LABEL,
  rate,
  signatoryLines,
  UNKNOWN_SIGNATORY,
  weekKey,
  weekStart,
} from "../email-stats";

/**
 * **Un fait et une estimation ne s'affichent pas pareil.**
 *
 * Les envois, les réponses et les rendez-vous sont des faits. Le taux
 * d'ouverture ne l'est pas : il est surestimé dans un sens connu, et le tester
 * revient surtout à tester qu'on ne peut pas l'afficher sans sa mise en garde.
 */

describe("les taux", () => {
  it("n'invente aucun taux sans dénominateur", () => {
    // Zéro pour cent affirme un échec d'ouverture ; sur zéro envoi suivi, il
    // n'y a rien à ouvrir. Même règle que l'entonnoir du jalon 20.
    expect(rate(0, 0).value).toBeNull();
    expect(formatRate(rate(0, 0))).toBe("—");
  });

  it("calcule et arrondit quand le dénominateur existe", () => {
    expect(rate(1, 4).value).toBe(0.25);
    expect(formatRate(rate(1, 4))).toBe("25 %");
    expect(formatRate(rate(0, 4))).toBe("0 %");
  });

  it("le libellé annonce l'estimation, et la mise en garde nomme les deux causes", () => {
    expect(OPEN_RATE_LABEL).toContain("estimation");
    expect(OPEN_RATE_CAVEAT).toContain("Apple Mail");
    expect(OPEN_RATE_CAVEAT).toContain("Gmail");
    expect(OPEN_RATE_CAVEAT).toContain("surestim");
  });
});

describe("les semaines", () => {
  it("commencent le lundi", () => {
    // Un mercredi, un dimanche et le lundi lui-même tombent dans la même semaine.
    const monday = new Date(2026, 7, 17);
    expect(weekStart(new Date(2026, 7, 19)).getTime()).toBe(monday.getTime());
    expect(weekStart(new Date(2026, 7, 23)).getTime()).toBe(monday.getTime());
    expect(weekStart(monday).getTime()).toBe(monday.getTime());
    expect(weekKey(new Date(2026, 7, 23))).toBe("2026-08-17");
  });

  it("un dimanche appartient à la semaine qui vient de finir, pas à la suivante", () => {
    expect(weekKey(new Date(2026, 7, 16))).toBe("2026-08-10");
  });
});

describe("le découpage", () => {
  const now = new Date(2026, 7, 18);

  it("garde les jours creux à zéro", () => {
    // Une courbe qui saute les jours sans envoi transforme une semaine sans
    // prospection en une ligne continue — un mensonge visuel.
    const buckets = byDay([new Date(2026, 7, 18), new Date(2026, 7, 18)], now, 5);
    expect(buckets).toHaveLength(5);
    expect(buckets.map((bucket) => bucket.count)).toEqual([0, 0, 0, 0, 2]);
    expect(buckets[4]?.label).toBe("18/08");
  });

  it("rend les semaines dans l'ordre chronologique, la courante en dernier", () => {
    const buckets = byWeek([new Date(2026, 7, 18), new Date(2026, 7, 11)], now, 3);
    expect(buckets.map((bucket) => bucket.count)).toEqual([0, 1, 1]);
  });

});

describe("par signataire", () => {
  const YANIS = "Yanis Tidahy";
  const MOHAMED = "Mohamed Targani";
  const sends = [
    { contactId: "c1", signatoryName: YANIS, sentAt: new Date(2026, 7, 10) },
    { contactId: "c1", signatoryName: MOHAMED, sentAt: new Date(2026, 7, 14) },
    { contactId: "c2", signatoryName: YANIS, sentAt: new Date(2026, 7, 11) },
    { contactId: "c3", signatoryName: "", sentAt: new Date(2026, 7, 12) },
  ];

  it("ne perd aucun envoi quand le signataire manque", () => {
    // Le total par signataire doit rester égal au total des envois : écarter
    // les envois antérieurs au sélecteur ferait un tableau qui ne s'additionne
    // pas avec le chiffre affiché en tête de page.
    const lines = signatoryLines(sends, new Map());
    expect(lines.reduce((total, line) => total + line.messages, 0)).toBe(sends.length);
    expect(lines.map((line) => line.name)).toContain(UNKNOWN_SIGNATORY);
    expect(lines[0]).toMatchObject({ name: YANIS, messages: 2, people: 2 });
  });

  it("**crédite la réponse au dernier message qui la précède**", () => {
    // C'est à celui-là qu'on répond. Créditer le premier donnerait tout le
    // mérite à qui a ouvert la conversation ; créditer les deux compterait la
    // même réponse deux fois.
    const lines = signatoryLines(sends, new Map([["c1", new Date(2026, 7, 15)]]));
    expect(lines.find((line) => line.name === MOHAMED)?.replies).toBe(1);
    expect(lines.find((line) => line.name === YANIS)?.replies).toBe(0);
    expect(lines.reduce((total, line) => total + line.replies, 0)).toBe(1);
  });

  it("ignore un envoi postérieur à la réponse", () => {
    // On ne répond pas à un message qui n'était pas encore parti.
    const lines = signatoryLines(sends, new Map([["c1", new Date(2026, 7, 12)]]));
    expect(lines.find((line) => line.name === YANIS)?.replies).toBe(1);
    expect(lines.find((line) => line.name === MOHAMED)?.replies).toBe(0);
  });

  it("compte le taux sur les personnes écrites, jamais sur les messages", () => {
    const lines = signatoryLines(sends, new Map([["c2", new Date(2026, 7, 13)]]));
    const yanis = lines.find((line) => line.name === YANIS);
    expect(yanis?.people).toBe(2);
    expect(formatRate(yanis?.replyRate ?? rate(0, 0))).toBe("50 %");
  });

  it("une fiche supprimée reste une personne écrite", () => {
    // L'envoi survit à la suppression du contact (`SetNull`) : le compter pour
    // personne ferait mentir le taux dans le sens flatteur.
    const orphan = [{ contactId: null, signatoryName: YANIS, sentAt: new Date(2026, 7, 10) }];
    expect(signatoryLines(orphan, new Map())[0]?.people).toBe(1);
  });
});
