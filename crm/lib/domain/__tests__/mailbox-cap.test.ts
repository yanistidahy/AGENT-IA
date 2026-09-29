import { describe, expect, it } from "vitest";
import {
  CARRIED_LABEL,
  DEFAULT_DAILY_CAP,
  capReached,
  capRefusal,
  composeAllowance,
  describeAllowance,
  describeCappedBoxes,
  describeUsage,
  overCapNotice,
  parisDayKey,
  parisDayRange,
  remainingOf,
  sortByPriority,
} from "../mailbox-cap";

/**
 * **Le plafond quotidien par boîte.**
 *
 * Trois choses se testent ici et nulle part ailleurs : le **jour de Paris**
 * (qu'aucun serveur en UTC ne donne gratuitement), la **capacité** et ses
 * refus, et l'**ordre de priorité** — celui qui décide de ce que les derniers
 * créneaux du jour servent.
 */

const box = { mailboxId: "mb", from: "contact@auraflowai.fr", label: "Principale" };

describe("le jour est celui de Paris, pas celui du serveur", () => {
  it("un envoi de 23 h 30 à Paris compte pour ce jour-là, pas pour le lendemain UTC", () => {
    // 21:30 UTC en été = 23:30 à Paris. `getDate()` dirait « le 14 », et le
    // compte du 14 serait amputé de ses deux dernières heures.
    expect(parisDayKey(new Date("2026-07-14T21:30:00Z"))).toBe("2026-07-14");
  });

  it("un envoi de 00 h 30 à Paris ne compte pas pour la veille", () => {
    // 22:30 UTC le 14 = 00:30 le 15 à Paris.
    expect(parisDayKey(new Date("2026-07-14T22:30:00Z"))).toBe("2026-07-15");
  });

  it("les bornes encadrent exactement le jour parisien, en été comme en hiver", () => {
    const summer = parisDayRange(new Date("2026-07-14T10:00:00Z"));
    expect(summer.start.toISOString()).toBe("2026-07-13T22:00:00.000Z");
    expect(summer.end.toISOString()).toBe("2026-07-14T22:00:00.000Z");

    const winter = parisDayRange(new Date("2026-01-14T10:00:00Z"));
    expect(winter.start.toISOString()).toBe("2026-01-13T23:00:00.000Z");
    expect(winter.end.toISOString()).toBe("2026-01-14T23:00:00.000Z");
  });

  it("la nuit du changement d'heure fait un jour de 23 h, et les bornes le disent", () => {
    // Dernier dimanche de mars 2026 : le 29. Le jour parisien y dure 23 heures,
    // et c'est exactement la nuit où un décalage écrit en dur se trompe.
    const range = parisDayRange(new Date("2026-03-29T12:00:00Z"));
    expect(range.start.toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-03-29T22:00:00.000Z");
    expect((range.end.getTime() - range.start.getTime()) / 3_600_000).toBe(23);
  });

  it("la borne haute est exclue : le jour a des millisecondes", () => {
    const range = parisDayRange(new Date("2026-07-14T10:00:00Z"));
    const lastMoment = new Date(range.end.getTime() - 1);
    expect(parisDayKey(lastMoment)).toBe("2026-07-14");
    expect(parisDayKey(range.end)).toBe("2026-07-15");
  });
});

describe("la capacité, et ce qu'un refus dit", () => {
  it("cinquante par boîte, par défaut", () => {
    expect(DEFAULT_DAILY_CAP).toBe(50);
  });

  it("compte ce qui reste, sans jamais descendre sous zéro", () => {
    expect(remainingOf({ sent: 32, cap: 50 })).toBe(18);
    expect(remainingOf({ sent: 50, cap: 50 })).toBe(0);
    // Un email écrit à la main n'est pas bloqué : une boîte peut donc dépasser,
    // et « il reste -1 » ne veut rien dire.
    expect(remainingOf({ sent: 51, cap: 50 })).toBe(0);
  });

  it("zéro vaut « pas de plafond », et rien n'est alors jamais atteint", () => {
    expect(remainingOf({ sent: 900, cap: 0 })).toBeNull();
    expect(capReached({ sent: 900, cap: 0 })).toBe(false);
  });

  it("le refus nomme la boîte, le compte, et ce qui arrive ensuite", () => {
    expect(capRefusal({ ...box, sent: 50, cap: 50 })).toBe(
      "Plafond atteint pour contact@auraflowai.fr : 50/50 aujourd'hui. Ce départ partira demain.",
    );
  });

  it("la carte dit que le départ est reporté, jamais qu'il a échoué", () => {
    expect(CARRIED_LABEL).toBe("Reporté : plafond de la boîte atteint");
  });

  it("un email à la main est averti, jamais refusé", () => {
    const notice = overCapNotice({ ...box, sent: 50, cap: 50 });
    expect(notice).toContain("partira quand même");
    expect(notice).toContain("50/50");
    // Sous le plafond, aucun bruit : une alerte qui sonne toujours n'est plus lue.
    expect(overCapNotice({ ...box, sent: 12, cap: 50 })).toBe("");
  });

  it("le compteur de la file lit comme une ligne de comptabilité", () => {
    expect(
      describeUsage([
        { ...box, sent: 32, cap: 50 },
        { mailboxId: "m2", from: "yanis@auraflowai.fr", label: "Yanis", sent: 12, cap: 50 },
      ]),
    ).toBe("contact@auraflowai.fr 32/50 · yanis@auraflowai.fr 12/50");
    // Sans plafond, on ne fabrique pas un dénominateur.
    expect(describeUsage([{ ...box, sent: 7, cap: 0 }])).toBe("contact@auraflowai.fr 7/∞");
  });

  it("l'ordonnanceur nomme les boîtes pleines et dit qu'il continue", () => {
    const sentence = describeCappedBoxes([
      { ...box, sent: 50, cap: 50 },
      { mailboxId: "m2", from: "yanis@auraflowai.fr", label: "Yanis", sent: 3, cap: 50 },
    ]);
    expect(sentence).toContain("contact@auraflowai.fr (50/50)");
    expect(sentence).toContain("continue avec les autres");
    expect(sentence).not.toContain("yanis@");
    expect(describeCappedBoxes([{ ...box, sent: 3, cap: 50 }])).toBe("");
  });
});

describe("l'ordre dans lequel la capacité se dépense", () => {
  const day = (iso: string) => new Date(`2026-09-${iso}T08:00:00Z`);

  it("une relance passe devant trois premiers contacts, même plus anciens", () => {
    const rows = [
      { id: "a", step: 1, createdAt: day("01") },
      { id: "b", step: 1, createdAt: day("02") },
      { id: "c", step: 2, createdAt: day("28") },
      { id: "d", step: 1, createdAt: day("03") },
    ];
    expect(sortByPriority(rows).map((row) => row.id)).toEqual(["c", "a", "b", "d"]);
  });

  it("à l'intérieur d'un groupe, le plus ancien d'abord", () => {
    const rows = [
      { id: "jeune", step: 3, createdAt: day("20") },
      { id: "vieux", step: 2, createdAt: day("02") },
    ];
    // L'étape ne départage pas les relances entre elles : ce qui compte est
    // l'attente, et une étape 3 due depuis trois semaines passe devant.
    expect(sortByPriority(rows).map((row) => row.id)).toEqual(["vieux", "jeune"]);
  });

  it("deux départs du même instant sortent toujours dans le même ordre", () => {
    const rows = [
      { id: "b", step: 1, createdAt: day("10") },
      { id: "a", step: 1, createdAt: day("10") },
    ];
    expect(sortByPriority(rows).map((row) => row.id)).toEqual(["a", "b"]);
    // Et l'entrée n'est pas modifiée : une lecture ne réordonne pas sa source.
    expect(rows.map((row) => row.id)).toEqual(["b", "a"]);
  });
});

describe("ne pas payer un brouillon qui ne peut pas partir", () => {
  it("borne l'écriture à la capacité restante et dit le reste", () => {
    expect(composeAllowance(5, { sent: 48, cap: 50 })).toEqual({ write: 2, later: 3 });
    expect(composeAllowance(5, { sent: 50, cap: 50 })).toEqual({ write: 0, later: 5 });
    expect(composeAllowance(2, { sent: 10, cap: 50 })).toEqual({ write: 2, later: 0 });
  });

  it("sans plafond, rien n'est borné", () => {
    expect(composeAllowance(80, { sent: 300, cap: 0 })).toEqual({ write: 80, later: 0 });
  });

  it("la phrase ne s'affiche que s'il y a un reste", () => {
    expect(describeAllowance(0)).toBe("");
    expect(describeAllowance(1)).toContain("1 départ est laissé pour demain");
    expect(describeAllowance(3)).toContain("3 départs sont laissés pour demain");
  });
});
