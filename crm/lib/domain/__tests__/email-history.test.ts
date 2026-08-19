import { describe, expect, it } from "vitest";
import {
  DAILY_MAX_DAYS,
  DAILY_MIN_DAYS,
  historyDepth,
  WEEKLY_MAX_WEEKS,
  WEEKLY_MIN_DAYS,
} from "../email-history";

/**
 * **Un cadre vide est pire qu'une phrase.**
 *
 * Ces tests fixent les deux bornes qui décident de la forme de l'écran, et le
 * fait qu'un graphique absent dise toujours quand il reviendra. Les valeurs
 * limites sont testées des deux côtés : c'est là, et nulle part ailleurs, qu'un
 * décalage d'un jour se cache.
 */

const NOW = new Date(2026, 7, 18, 14, 30);

/** Un envoi passé il y a `days` jours. */
function ago(days: number): Date {
  return new Date(2026, 7, 18 - days, 9);
}

describe("l'étendue de l'histoire", () => {
  it("ne compte rien quand rien n'est parti", () => {
    const depth = historyDepth([], NOW);
    expect(depth.spanDays).toBe(0);
    expect(depth.daily).toBe(false);
    expect(depth.weekly).toBe(false);
    // Aucune phrase non plus : la page dit « aucun email envoyé », pas
    // « graphique à partir de 7 jours » — il n'y a pas de compte à rebours en
    // cours.
    expect(depth.missing).toHaveLength(0);
  });

  it("un seul envoi ce matin vaut une journée, pas zéro", () => {
    expect(historyDepth([ago(0)], NOW).spanDays).toBe(1);
  });

  it("se compte du premier envoi à aujourd'hui, bornes comprises, quel que soit l'ordre", () => {
    expect(historyDepth([ago(3), ago(10), ago(1)], NOW).spanDays).toBe(11);
  });

  it("l'heure ne déborde pas sur le jour voisin", () => {
    // 23 h 59 hier et 00 h 01 aujourd'hui font deux jours, pas trois.
    const late = new Date(2026, 7, 17, 23, 59);
    const early = new Date(2026, 7, 18, 0, 1);
    expect(historyDepth([late, early], NOW).spanDays).toBe(2);
  });

  it("une date postérieure à maintenant ne rallonge pas l'histoire", () => {
    const future = new Date(2026, 7, 25, 9);
    expect(historyDepth([future], NOW).spanDays).toBe(1);
  });
});

describe("la borne du graphique quotidien", () => {
  it("**six jours d'activité : aucun graphique**", () => {
    // Le cas signalé : onze emails sur une semaine, et un écran qui montre
    // surtout du vide. La liste des envois porte la substance.
    const depth = historyDepth([ago(5), ago(2), ago(0)], NOW);
    expect(depth.spanDays).toBe(6);
    expect(depth.daily).toBe(false);
    expect(depth.weekly).toBe(false);
    expect(depth.dailyDays).toBe(0);
  });

  it("sept jours : le quotidien apparaît, sur l'étendue réelle", () => {
    const depth = historyDepth([ago(6)], NOW);
    expect(depth.spanDays).toBe(DAILY_MIN_DAYS);
    expect(depth.daily).toBe(true);
    // **Sept barres, pas trente.** Vingt-trois colonnes à zéro affirmeraient
    // une inactivité antérieure à la première mesure.
    expect(depth.dailyDays).toBe(7);
    expect(depth.weekly).toBe(false);
  });

  it("plafonne le quotidien à trente jours quand l'histoire est plus longue", () => {
    expect(historyDepth([ago(200)], NOW).dailyDays).toBe(DAILY_MAX_DAYS);
  });
});

describe("la borne du graphique hebdomadaire", () => {
  it("vingt-sept jours : toujours pas d'hebdomadaire", () => {
    const depth = historyDepth([ago(26)], NOW);
    expect(depth.spanDays).toBe(27);
    expect(depth.daily).toBe(true);
    expect(depth.weekly).toBe(false);
  });

  it("vingt-huit jours : l'hebdomadaire arrive, et le quotidien reste", () => {
    const depth = historyDepth([ago(27)], NOW);
    expect(depth.spanDays).toBe(WEEKLY_MIN_DAYS);
    expect(depth.weekly).toBe(true);
    expect(depth.weeklyWeeks).toBe(4);
    expect(depth.daily).toBe(true);
    expect(depth.missing).toHaveLength(0);
  });

  it("plafonne à douze semaines", () => {
    expect(historyDepth([ago(400)], NOW).weeklyWeeks).toBe(WEEKLY_MAX_WEEKS);
  });
});

describe("ce qui manque se dit, et dit quand il revient", () => {
  it("nomme la condition de retour du graphique hebdomadaire, mot pour mot", () => {
    const depth = historyDepth([ago(6)], NOW);
    const weekly = depth.missing.find((entry) => entry.chart === "weekly");
    expect(weekly?.notice).toContain("Graphique hebdomadaire à partir de 4 semaines d'activité");
    // Et le nombre de jours restants, sinon « à partir de 4 semaines » ne dit
    // pas si l'on est à trois jours ou à trois semaines de l'échéance.
    expect(weekly?.notice).toContain("21 jours");
  });

  it("nomme aussi le quotidien, et pourquoi la liste vaut mieux en attendant", () => {
    const daily = historyDepth([ago(5)], NOW).missing.find((entry) => entry.chart === "daily");
    expect(daily?.notice).toContain("7 jours d'activité");
    expect(daily?.notice).toContain("liste des envois");
  });

  it("accorde le singulier quand il ne reste qu'un jour", () => {
    // « encore 1 jours » est le détail qui fait passer un écran pour un
    // brouillon.
    const daily = historyDepth([ago(5)], NOW).missing.find((entry) => entry.chart === "daily");
    expect(daily?.notice).toContain("encore 1 jour.");
    expect(daily?.notice).not.toContain("encore 1 jours");
  });

  it("ne dit rien quand tout se rend", () => {
    expect(historyDepth([ago(60)], NOW).missing).toHaveLength(0);
  });
});
