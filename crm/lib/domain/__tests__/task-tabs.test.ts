import { describe, expect, it } from "vitest";
import {
  applyTaskFilters,
  countTab,
  emptyState,
  paginate,
  rowsForTab,
  TASK_TABS,
  tabCounts,
  type FeedRow,
  type TaskTabId,
} from "../task-tabs";

/**
 * **La pastille et la liste sortent du même prédicat, et ce test le prouve sur
 * les six onglets.** Un écart entre les deux serait un défaut — c'est celui que
 * le jalon 49 a payé entre une puce et sa liste, et le jalon 78 entre une carte
 * et son tableau.
 */

const NOW = new Date("2026-09-27T10:00:00Z");
const day = (offset: number) => new Date(NOW.getTime() + offset * 86_400_000);

function row(over: Partial<FeedRow> & Pick<FeedRow, "id" | "kind">): FeedRow {
  return {
    title: over.id,
    detail: "",
    due: null,
    done: false,
    priority: null,
    owner: "",
    contactId: null,
    contactName: "",
    href: null,
    isCall: false,
    pendingSend: false,
    unhandledReply: false,
    hotSignal: null,
    terminal: false,
    at: NOW,
    searchText: (over.title ?? over.id).toLowerCase(),
    ...over,
  };
}

/** Un jeu couvrant **chaque** origine de travail, plus les cas limites. */
const POPULATION: readonly FeedRow[] = [
  row({ id: "tache:retard", kind: "task", title: "Relancer Nadia", due: day(-3), owner: "Yanis" }),
  row({ id: "tache:jour", kind: "task", title: "Appeler Oscar", due: day(0), isCall: true }),
  row({
    id: "tache:appel-futur",
    kind: "task",
    title: "Rappeler Paul",
    due: day(5),
    isCall: true,
    priority: "haute",
  }),
  row({ id: "tache:sans-date", kind: "task", title: "Préparer le devis", due: null }),
  row({ id: "tache:faite", kind: "task", title: "Appeler Rita", due: day(-1), isCall: true, done: true }),
  row({ id: "depart:1", kind: "departure", title: "Départ pour Sonia", pendingSend: true }),
  row({ id: "depart:2", kind: "departure", title: "Départ pour Théo", pendingSend: false }),
  row({ id: "reponse:1", kind: "reply", title: "Ursule a répondu", unhandledReply: true }),
  row({ id: "reponse:2", kind: "reply", title: "Victor a répondu", unhandledReply: false }),
  row({ id: "chaud:clic", kind: "hot", title: "Wanda a cliqué", hotSignal: "click", at: day(-2) }),
  row({ id: "chaud:vieux", kind: "hot", title: "Xavier a cliqué", hotSignal: "click", at: day(-30) }),
  row({ id: "chaud:perdu", kind: "hot", title: "Yann a répondu", hotSignal: "reply", terminal: true }),
];

describe("un prédicat par onglet, pour la pastille comme pour la liste", () => {
  it("chaque pastille égale la longueur de sa liste, sur les six onglets", () => {
    const counts = tabCounts(POPULATION, NOW);
    const gaps = TASK_TABS.filter(
      (tab) => counts[tab.id] !== rowsForTab(POPULATION, tab.id, NOW).length,
    ).map((tab) => tab.id);
    expect(gaps).toEqual([]);
  });

  it("chaque onglet retient ce qu'il promet", () => {
    const ids = (tab: TaskTabId) => rowsForTab(POPULATION, tab, NOW).map((entry) => entry.id);

    // Dû aujourd'hui ou en retard, pas terminé. Une échéance future en sort.
    expect(ids("vos")).toEqual(["tache:retard", "tache:jour"]);
    expect(ids("appels")).toEqual(["tache:jour", "tache:appel-futur"]);
    expect(ids("envoyer")).toEqual(["depart:1"]);
    expect(ids("reponses")).toEqual(["reponse:1"]);
    expect(ids("chauds")).toEqual(["chaud:clic"]);
    expect(ids("toutes")).not.toContain("tache:faite");
  });

  /**
   * **Une ouverture de pixel ne rend personne chaud.** Notre suivi surestime par
   * construction (jalons 37 et 43) : un prospect qu'Apple Mail a « ouvert » à la
   * réception n'a rien fait, et l'appeler ferait perdre confiance au seul écran
   * dont la valeur est de ne contenir que du vrai.
   */
  it("cinq ouvertures ne suffisent pas, un clic suffit", () => {
    const opened = row({ id: "chaud:ouvreur", kind: "hot", title: "Zoé a ouvert 5 fois" });
    expect(rowsForTab([opened], "chauds", NOW)).toEqual([]);

    const clicked = { ...opened, hotSignal: "click" as const, at: day(-1) };
    expect(rowsForTab([clicked], "chauds", NOW).map((entry) => entry.id)).toEqual([
      "chaud:ouvreur",
    ]);
  });

  it("une fiche close paraît dans les réponses, jamais dans les prospects chauds", () => {
    const reply = row({
      id: "reponse:perdu",
      kind: "reply",
      title: "Yann a répondu",
      unhandledReply: true,
      terminal: true,
    });
    const hot = row({
      id: "chaud:perdu2",
      kind: "hot",
      title: "Yann a répondu",
      hotSignal: "reply",
      terminal: true,
    });
    expect(rowsForTab([reply, hot], "reponses", NOW).length).toBe(1);
    expect(rowsForTab([reply, hot], "chauds", NOW)).toEqual([]);
  });

  it("un signal de plus de quatorze jours sort de l'onglet", () => {
    expect(countTab(POPULATION, "chauds", NOW)).toBe(1);
  });
});

describe("l'état vide dit pourquoi", () => {
  it("nomme les filtres qui masquent, et leur compte", () => {
    const inTab = rowsForTab(POPULATION, "toutes", NOW);
    const filters = { owner: "Personne", priority: "haute" as const };
    const shown = applyTaskFilters(inTab, filters, "");
    expect(shown).toEqual([]);

    const state = emptyState("toutes", inTab.length, shown.length, filters, "");
    expect(state?.kind).toBe("filtered");
    expect(state?.message).toBe(`2 filtres actifs masquent ${inTab.length} tâches`);
  });

  it("la recherche compte pour un filtre", () => {
    const state = emptyState("toutes", 7, 0, { owner: "Yanis" }, "introuvable");
    expect(state?.message).toBe("2 filtres actifs masquent 7 tâches");
  });

  it("un onglet réellement vide nomme sa règle, sans parler de filtres", () => {
    const state = emptyState("appels", 0, 0, {}, "");
    expect(state?.kind).toBe("empty");
    expect(state?.message).toContain("Aucune tâche dans cet onglet");
    expect(state?.message).toContain("appel");
  });

  it("retirer les filtres rend la liste", () => {
    const inTab = rowsForTab(POPULATION, "toutes", NOW);
    expect(applyTaskFilters(inTab, {}, "").length).toBe(inTab.length);
    expect(emptyState("toutes", inTab.length, inTab.length, {}, "")).toBeNull();
  });
});

describe("la pagination annonce ce qu'elle montre", () => {
  it("« 1 - 20 de 47 », puis la page suivante", () => {
    const many = Array.from({ length: 47 }, (_value, index) =>
      row({ id: `tache:${index}`, kind: "task" }),
    );
    expect(paginate(many, 1).range).toBe("1 - 20 de 47");
    expect(paginate(many, 3).range).toBe("41 - 47 de 47");
    // Une page hors bornes retombe sur la dernière, jamais sur une liste vide.
    expect(paginate(many, 9).page).toBe(3);
    expect(paginate([], 1).range).toBe("");
  });
});
