import { describe, expect, it } from "vitest";
import {
  ALL_PEOPLE,
  bannerText,
  emptyState,
  paginate,
  tabView,
  TASK_TABS,
  type TaskRow,
} from "../task-tabs";
import { dialHref, kindFromTitle, toTaskKind } from "../task-kind";

/**
 * Les quatre onglets, le filtre par personne et les bandeaux.
 *
 * L'horloge est injectée partout : sans cela « aujourd'hui » serait vrai un jour
 * sur deux selon l'heure à laquelle la suite tourne (leçon du jalon 102).
 */

const NOW = new Date("2026-10-03T12:00:00Z");

function row(over: Partial<TaskRow> & { readonly id: string }): TaskRow {
  return {
    title: `tâche ${over.id}`,
    kind: "tache",
    due: new Date("2026-10-03T09:00:00Z"),
    done: false,
    doneAt: null,
    priority: "normale",
    assignee: "Yanis",
    contactId: null,
    contactName: "",
    contactPhone: "",
    detail: "",
    href: null,
    searchText: `tache ${over.id}`,
    ...over,
  };
}

describe("les quatre onglets", () => {
  it("« Aujourd'hui » retient le jour et le retard, tous types confondus", () => {
    const rows = [
      row({ id: "retard", due: new Date("2026-09-28T09:00:00Z") }),
      row({ id: "jour" }),
      row({ id: "appel-jour", kind: "appel" }),
      row({ id: "demain", due: new Date("2026-10-04T09:00:00Z") }),
    ];
    const view = tabView(rows, "aujourdhui", ALL_PEOPLE, NOW);
    expect(view.inTab.map((entry) => entry.id)).toEqual(["retard", "jour", "appel-jour"]);
  });

  it("« Aujourd'hui » trie le plus en retard d'abord", () => {
    const rows = [
      row({ id: "hier", due: new Date("2026-10-02T09:00:00Z") }),
      row({ id: "vieux", due: new Date("2026-09-20T09:00:00Z") }),
      row({ id: "jour" }),
    ];
    expect(tabView(rows, "aujourdhui", ALL_PEOPLE, NOW).inTab.map((e) => e.id)).toEqual([
      "vieux",
      "hier",
      "jour",
    ]);
  });

  it("« Appels » retient le type, pas l'intitulé", () => {
    /*
      C'est la réparation du jalon 92 : « Joindre Sophie » n'entrait pas dans
      l'onglet faute de colonne. Elle y entre maintenant si son type le dit, et
      « Appeler le comptable » n'y entre pas si son type dit autre chose.
    */
    const rows = [
      row({ id: "joindre", title: "Joindre Sophie au standard", kind: "appel" }),
      row({ id: "intitule", title: "Appeler le comptable", kind: "email" }),
    ];
    expect(tabView(rows, "appels", ALL_PEOPLE, NOW).inTab.map((e) => e.id)).toEqual(["joindre"]);
  });

  it("« À venir » commence demain, jamais aujourd'hui", () => {
    const rows = [
      row({ id: "jour" }),
      row({ id: "demain", due: new Date("2026-10-04T09:00:00Z") }),
    ];
    const view = tabView(rows, "avenir", ALL_PEOPLE, NOW);
    expect(view.inTab.map((e) => e.id)).toEqual(["demain"]);
    expect(view.counts.aujourdhui).toBe(1);
  });

  it("« Terminées » trie la plus récente d'abord, et retombe sur l'échéance", () => {
    const rows = [
      row({ id: "vieille", done: true, doneAt: new Date("2026-09-01T09:00:00Z") }),
      row({ id: "fraiche", done: true, doneAt: new Date("2026-10-02T09:00:00Z") }),
      // Cochée avant que `doneAt` existe : son échéance tient lieu de date.
      row({ id: "sans-date", done: true, doneAt: null, due: new Date("2026-10-01T09:00:00Z") }),
    ];
    expect(tabView(rows, "terminees", ALL_PEOPLE, NOW).inTab.map((e) => e.id)).toEqual([
      "fraiche",
      "sans-date",
      "vieille",
    ]);
  });

  it("une tâche terminée disparaît des trois onglets de travail", () => {
    const rows = [row({ id: "faite", kind: "appel", done: true, doneAt: NOW })];
    const counts = tabView(rows, "aujourdhui", ALL_PEOPLE, NOW).counts;
    expect(counts).toEqual({ aujourdhui: 0, appels: 0, avenir: 0, terminees: 1 });
  });
});

describe("le filtre par personne", () => {
  const rows = [
    row({ id: "y1", assignee: "Yanis" }),
    row({ id: "y2", assignee: "Yanis", kind: "appel" }),
    row({ id: "m1", assignee: "Mohamed" }),
    row({ id: "sans", assignee: "" }),
  ];

  it("« Tous » garde tout le monde, y compris les non assignées", () => {
    expect(tabView(rows, "aujourdhui", ALL_PEOPLE, NOW).counts.aujourdhui).toBe(4);
  });

  it("une personne ne voit que ses tâches, pastille comprise", () => {
    const view = tabView(rows, "aujourdhui", "Mohamed", NOW);
    expect(view.counts.aujourdhui).toBe(1);
    expect(view.inTab.map((e) => e.id)).toEqual(["m1"]);
    // **Et c'est la même valeur** : c'est l'invariant du jalon.
    expect(view.counts.aujourdhui).toBe(view.inTab.length);
  });

  it("le filtre s'applique à chacune des quatre pastilles", () => {
    const view = tabView(rows, "aujourdhui", "Yanis", NOW);
    expect(view.counts).toEqual({ aujourdhui: 2, appels: 1, avenir: 0, terminees: 0 });
  });

  it("une personne inconnue ne rend rien, plutôt que tout", () => {
    // Le repli inverse — « je ne connais pas, je montre tout » — ferait croire
    // qu'on regarde le travail de quelqu'un alors qu'on regarde celui de tous.
    expect(tabView(rows, "aujourdhui", "Fantôme", NOW).inTab).toHaveLength(0);
  });
});

describe("les filtres et la recherche n'entrent pas dans la pastille", () => {
  const rows = [
    row({ id: "a", searchText: "appeler nina" }),
    row({ id: "b", searchText: "preparer la proposition", priority: "haute" }),
  ];

  it("la recherche réduit la liste, pas le compte", () => {
    const view = tabView(rows, "aujourdhui", ALL_PEOPLE, NOW, {}, "nina");
    expect(view.counts.aujourdhui).toBe(2);
    expect(view.inTab).toHaveLength(2);
    expect(view.shown.map((e) => e.id)).toEqual(["a"]);
  });

  it("la recherche ignore les accents et la casse", () => {
    const accented = [row({ id: "x", searchText: "preparer la proposition" })];
    expect(tabView(accented, "aujourdhui", ALL_PEOPLE, NOW, {}, "PRÉPARER").shown).toHaveLength(1);
  });

  it("le filtre de priorité porte sur la liste affichée", () => {
    const view = tabView(rows, "aujourdhui", ALL_PEOPLE, NOW, { priority: "haute" });
    expect(view.shown.map((e) => e.id)).toEqual(["b"]);
    expect(view.counts.aujourdhui).toBe(2);
  });
});

describe("l'état vide dit pourquoi", () => {
  it("distingue un onglet vide d'un filtre qui masque", () => {
    const filtered = emptyState("aujourdhui", ALL_PEOPLE, 7, 0, { priority: "haute" }, "");
    expect(filtered?.kind).toBe("filtered");
    expect(filtered?.message).toContain("1 filtre actif masque 7 tâches");

    const vide = emptyState("aujourdhui", ALL_PEOPLE, 0, 0, {}, "");
    expect(vide?.kind).toBe("empty");
    expect(vide?.message).toContain("aujourd'hui ou en retard");
  });

  it("nomme la personne quand c'est elle qui n'a rien", () => {
    const message = emptyState("appels", "Mohamed", 0, 0, {}, "")?.message ?? "";
    expect(message).toContain("Rien pour Mohamed");
  });

  it("ne dit rien quand il y a quelque chose à montrer", () => {
    expect(emptyState("aujourdhui", ALL_PEOPLE, 3, 3, {}, "")).toBeNull();
  });
});

describe("les bandeaux", () => {
  it("se taisent à zéro", () => {
    expect(bannerText({ pendingSends: 0, unhandledReplies: 0, hotProspects: 0 })).toEqual({
      sends: null,
      replies: null,
      hot: null,
    });
  });

  it("portent leur nombre et s'accordent", () => {
    const one = bannerText({ pendingSends: 1, unhandledReplies: 1, hotProspects: 1 });
    expect(one.sends).toBe("1 mail prêt à partir");
    expect(one.replies).toBe("1 réponse à traiter");
    expect(one.hot).toBe("1 prospect chaud");

    const many = bannerText({ pendingSends: 14, unhandledReplies: 3, hotProspects: 20 });
    expect(many.sends).toBe("14 mails prêts à partir");
    expect(many.replies).toBe("3 réponses à traiter");
    expect(many.hot).toBe("20 prospects chauds");
  });
});

describe("le type d'une tâche", () => {
  it("retombe sur « tache » plutôt que de lever", () => {
    expect(toTaskKind("appel")).toBe("appel");
    expect(toTaskKind("inconnu")).toBe("tache");
    expect(toTaskKind("")).toBe("tache");
  });

  it("la reprise de l'existant lit l'intitulé, sur des mots entiers", () => {
    expect(kindFromTitle("Appeler Nina")).toBe("appel");
    expect(kindFromTitle("Relancer par téléphone")).toBe("appel");
    expect(kindFromTitle("Rappeler Paul")).toBe("appel");
    // « coordinatrice » ne contient pas « appel » (règle des mots entiers,
    // jalon 94) — et une tâche sans indice reste une tâche.
    expect(kindFromTitle("Préparer la proposition")).toBe("tache");
    expect(kindFromTitle("Joindre Sophie au standard")).toBe("tache");
  });

  it("le bouton d'appel n'apparaît que sur un numéro composable", () => {
    expect(dialHref("06 11 22 33 44")).toBe("tel:0611223344");
    expect(dialHref("+33 6 11 22 33 44")).toBe("tel:+33611223344");
    // Un champ libre peut porter une phrase : un lien `tel:` dessus ne
    // composerait rien tout en ayant l'air d'un bouton.
    expect(dialHref("à demander au standard")).toBeNull();
    expect(dialHref("")).toBeNull();
    expect(dialHref("12 34")).toBeNull();
  });
});

describe("la pagination", () => {
  it("borne la page et décrit la tranche", () => {
    const rows = Array.from({ length: 47 }, (_, index) => row({ id: `r${index}` }));
    expect(paginate(rows, 1).range).toBe("1 - 20 de 47");
    expect(paginate(rows, 3).rows).toHaveLength(7);
    expect(paginate(rows, 99).page).toBe(3);
    expect(paginate([], 1).range).toBe("");
  });
});

describe("les onglets déclarés", () => {
  it("sont exactement quatre, dans l'ordre demandé", () => {
    expect(TASK_TABS.map((tab) => tab.id)).toEqual([
      "aujourdhui",
      "appels",
      "avenir",
      "terminees",
    ]);
  });

  it("chacun dit ce qu'il retient, pour son état vide", () => {
    for (const tab of TASK_TABS) expect(tab.rule.length).toBeGreaterThan(10);
  });
});
