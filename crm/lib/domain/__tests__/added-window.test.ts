import { describe, expect, it } from "vitest";
import {
  ADDED_PRESETS,
  describeWindow,
  parseDay,
  presetWindow,
  resolveWindow,
} from "../added-window";

/** Jeudi 10 septembre 2026, 14 h 30. */
const NOW = new Date(2026, 8, 10, 14, 30, 0);
const iso = (date: Date) => date.toISOString().slice(0, 16);

describe("les préréglages décrivent ce qu'on attend d'eux", () => {
  it("« aujourd'hui » va de minuit à minuit le lendemain", () => {
    const window = presetWindow("aujourdhui", NOW);
    expect(iso(window.from)).toBe(iso(new Date(2026, 8, 10, 0, 0)));
    expect(iso(window.to)).toBe(iso(new Date(2026, 8, 11, 0, 0)));
  });

  it("« cette semaine » part du lundi, pas de sept jours en arrière", () => {
    // Jeudi 10 → lundi 7. Sept jours glissants donneraient vendredi 4, et le
    // lundi matin la liste montrerait le travail de la semaine passée.
    expect(iso(presetWindow("semaine", NOW).from)).toBe(iso(new Date(2026, 8, 7, 0, 0)));
  });

  it("un dimanche appartient à la semaine qui s'achève", () => {
    const sunday = new Date(2026, 8, 13, 11, 0);
    expect(iso(presetWindow("semaine", sunday).from)).toBe(iso(new Date(2026, 8, 7, 0, 0)));
  });

  it("« ce mois » part du 1er", () => {
    expect(iso(presetWindow("mois", NOW).from)).toBe(iso(new Date(2026, 8, 1, 0, 0)));
  });

  it("« 30 jours » est glissant, et aujourd'hui en fait partie", () => {
    // 29 jours en arrière, plus aujourd'hui, font bien trente jours.
    expect(iso(presetWindow("30j", NOW).from)).toBe(iso(new Date(2026, 7, 12, 0, 0)));
  });

  it("la borne haute est exclue, donc rien ne tombe entre les mailles", () => {
    for (const preset of ADDED_PRESETS) {
      const window = presetWindow(preset, NOW);
      const lateToday = new Date(2026, 8, 10, 23, 59, 59, 400);
      expect(lateToday >= window.from && lateToday < window.to).toBe(true);
    }
  });
});

describe("la plage libre", () => {
  it("accepte une seule borne", () => {
    const since = resolveWindow({ from: "2026-03-01" }, NOW);
    expect(since?.from.getFullYear()).toBe(2026);
    expect(resolveWindow({ to: "2026-03-31" }, NOW)).not.toBeNull();
  });

  it("remet deux bornes inversées dans l'ordre plutôt que de refuser", () => {
    const window = resolveWindow({ from: "2026-03-31", to: "2026-03-01" }, NOW);
    expect(window).not.toBeNull();
    expect(window!.from < window!.to).toBe(true);
  });

  it("inclut le dernier jour en entier", () => {
    const window = resolveWindow({ from: "2026-03-01", to: "2026-03-31" }, NOW);
    const lastMoment = new Date(2026, 2, 31, 23, 59, 59, 900);
    expect(lastMoment < window!.to).toBe(true);
  });

  it("ignore ce qui ne décrit aucune date", () => {
    expect(resolveWindow({}, NOW)).toBeNull();
    expect(resolveWindow({ from: "hier" }, NOW)).toBeNull();
    // Une forme bien découpée mais impossible reste refusée : `Date` rend
    // « Invalid Date », et l'on ne devine pas ce que « mois 13 » voulait dire.
    expect(parseDay("2026-13-45")).toBeNull();
    expect(parseDay("01/03/2026")).toBeNull();
  });

  it("le préréglage l'emporte sur la plage : un seul filtre à la fois", () => {
    const window = resolveWindow({ preset: "aujourdhui", from: "2020-01-01" }, NOW);
    expect(iso(window!.from)).toBe(iso(new Date(2026, 8, 10, 0, 0)));
  });
});

describe("ce que la puce affiche", () => {
  it("nomme la plage active", () => {
    expect(describeWindow("2026-03-01", "2026-03-31")).toBe("du 01/03 au 31/03");
    expect(describeWindow("2026-03-01", undefined)).toBe("depuis le 01/03");
    expect(describeWindow(undefined, "2026-03-31")).toBe("jusqu'au 31/03");
  });
});
