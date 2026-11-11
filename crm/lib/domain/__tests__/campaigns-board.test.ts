import { describe, expect, it } from "vitest";
import {
  QUIET_DAYS,
  boardLines,
  boardState,
  pausedNotice,
  sortBoard,
  stateFromLemlist,
  stepLabel,
  stepLines,
  toBoardSort,
  toSortDir,
  waitingToLaunch,
  type CampaignReport,
} from "../campaigns-board";
import { customPeriod, type EventRow } from "../pilotage";
import type { OutreachChannel, OutreachType } from "../outreach";

/**
 * **« Campagnes côte à côte », et le résultat par étape.**
 *
 * Deux choses sont mesurées ici, et ce sont celles qui décident quoi retirer
 * d'une séquence :
 *
 * 1. **le taux d'une étape a son propre dénominateur** — les personnes que
 *    *cette* étape a touchées. Diviser les réponses de l'étape 3 par les
 *    inscrits de la campagne donnerait un taux qui baisse à chaque relance, et
 *    on conclurait que les relances ne marchent pas ;
 * 2. **une réponse est rattachée à l'étape du dernier message parti** — une
 *    réponse ne porte pas d'étape, et sans cette attribution chaque étape
 *    afficherait 0 réponse et 0 %, c'est-à-dire un échec affirmé là où la
 *    donnée n'était pas rattachée.
 */

let seq = 0;

function row(
  contactId: string | null,
  type: OutreachType,
  iso: string,
  extra: Partial<EventRow> = {},
): EventRow {
  seq += 1;
  return {
    id: `e${seq}`,
    contactId,
    contactName: contactId ?? "Sans contact",
    companyName: "",
    campaignId: null,
    campaignName: "",
    extCampaignId: "",
    extCampaignName: "",
    channel: "email" as OutreachChannel,
    type,
    occurredAt: new Date(iso),
    owner: "Yanis",
    source: "crm",
    replyCategory: "",
    size: "unknown",
    niche: "",
    stepIndex: null,
    stepType: "",
    group: "Non classé",
    ...extra,
  };
}

const NOW = new Date("2026-11-13T12:00:00Z");
const PERIOD = customPeriod(new Date("2026-09-01T12:00:00Z"), new Date("2026-11-13T12:00:00Z"));

describe("l'état d'une campagne", () => {
  it("dit « terminée » seulement pour une campagne du CRM archivée", () => {
    expect(boardState({ archived: true, reported: "", lastFactAt: NOW, now: NOW })).toBe("done");
  });

  it("dit « en cours » tant qu'un fait est récent", () => {
    const recent = new Date(NOW.getTime() - (QUIET_DAYS - 1) * 86_400_000);
    expect(boardState({ archived: false, reported: "", lastFactAt: recent, now: NOW })).toBe(
      "running",
    );
  });

  /**
   * **« En pause » couvre deux réalités, et c'est assumé.** Une activité
   * lemlist ne porte aucun état de campagne — vérifié contre le schéma publié
   * de l'objet Activity —, donc une campagne lemlist arrêtée pour de bon et une
   * campagne simplement silencieuse se lisent pareil. Afficher « terminée »
   * sans le savoir serait une affirmation ; l'écran le dit au survol.
   */
  it("dit « en pause » après trente jours de silence, et sur une campagne sans fait", () => {
    const old = new Date(NOW.getTime() - (QUIET_DAYS + 1) * 86_400_000);
    expect(boardState({ archived: false, reported: "", lastFactAt: old, now: NOW })).toBe("paused");
    expect(boardState({ archived: false, reported: "", lastFactAt: null, now: NOW })).toBe("paused");
  });

  /**
   * **Un fait relevé bat une déduction.** Le jalon 114 lit le `status` publié
   * par `GET /campaigns` : une campagne muette depuis deux mois mais que lemlist
   * déclare `running` est en cours, et une campagne active hier mais déclarée
   * `ended` est terminée. Sans cette priorité, le relevé serait stocké pour rien.
   */
  it("préfère l'état relevé chez lemlist au silence de trente jours", () => {
    const old = new Date(NOW.getTime() - (QUIET_DAYS + 1) * 86_400_000);
    expect(boardState({ archived: false, reported: "running", lastFactAt: old, now: NOW })).toBe(
      "running",
    );
    expect(boardState({ archived: false, reported: "ended", lastFactAt: NOW, now: NOW })).toBe(
      "done",
    );
  });

  it("laisse l'archivage du CRM gagner sur le relevé", () => {
    expect(boardState({ archived: true, reported: "running", lastFactAt: NOW, now: NOW })).toBe(
      "done",
    );
  });

  it("traduit les six états de lemlist, et refuse d'en ranger un inconnu", () => {
    expect(stateFromLemlist("running")).toBe("running");
    expect(stateFromLemlist("paused")).toBe("paused");
    expect(stateFromLemlist("draft")).toBe("paused");
    expect(stateFromLemlist("errors")).toBe("paused");
    expect(stateFromLemlist("ended")).toBe("done");
    expect(stateFromLemlist("archived")).toBe("done");
    // Un état que lemlist ajouterait demain retombe sur la déduction plutôt que
    // dans une case choisie au hasard.
    expect(stateFromLemlist("quelque-chose")).toBeNull();
    expect(stateFromLemlist("")).toBeNull();
  });
});

describe("les prospects qui attendent d'être lancés", () => {
  it("rend la différence entre inscrits et lancés", () => {
    expect(waitingToLaunch({ leads: 12, leadsLaunched: 9 })).toBe(3);
    expect(waitingToLaunch({ leads: 9, leadsLaunched: 9 })).toBe(0);
  });

  /**
   * **`null` n'est pas zéro.** « 0 prospect attend » sur une campagne dont on
   * n'a rien relevé serait une affirmation non vérifiée — la règle du jalon 20.
   */
  it("dit « on ne sait pas » plutôt que zéro quand le relevé manque", () => {
    expect(waitingToLaunch({ leads: null, leadsLaunched: 9 })).toBeNull();
    expect(waitingToLaunch({ leads: 12, leadsLaunched: null })).toBeNull();
  });

  it("refuse un compte négatif au lieu de le ramener à zéro", () => {
    // Plus de lancés que d'inscrits voudrait dire qu'on a mal compris la route :
    // un `Math.max(0, …)` cacherait exactement ce qu'il faut voir.
    expect(waitingToLaunch({ leads: 5, leadsLaunched: 9 })).toBeNull();
  });

  it("écrit la phrase du brief, au singulier comme au pluriel", () => {
    expect(pausedNotice({ state: "paused", waiting: 3 })).toBe(
      "Campagne en pause : 3 prospects attendent d'être lancés",
    );
    expect(pausedNotice({ state: "paused", waiting: 1 })).toBe(
      "Campagne en pause : 1 prospect attend d'être lancé",
    );
  });

  it("se taît quand la phrase ne dirait rien", () => {
    expect(pausedNotice({ state: "paused", waiting: 0 })).toBeNull();
    expect(pausedNotice({ state: "paused", waiting: null })).toBeNull();
    expect(pausedNotice({ state: "running", waiting: 7 })).toBeNull();
    expect(pausedNotice({ state: "done", waiting: 7 })).toBeNull();
  });
});

describe("le tableau des campagnes", () => {
  const rows = [
    row("a", "message_sent", "2026-11-03T09:00:00Z", {
      extCampaignId: "L1",
      extCampaignName: "Novembre",
    }),
    row("a", "linkedin_invite_sent", "2026-11-03T10:00:00Z", {
      extCampaignId: "L1",
      extCampaignName: "Novembre",
      channel: "linkedin_invite",
    }),
    row("a", "reply_received", "2026-11-04T09:00:00Z", {
      extCampaignId: "L1",
      extCampaignName: "Novembre",
    }),
    row("b", "message_sent", "2026-11-03T09:00:00Z", {
      campaignId: "k1",
      campaignName: "Relance CRM",
    }),
    row("a", "linkedin_invite_accepted", "2026-11-04T10:00:00Z", {
      extCampaignId: "L1",
      extCampaignName: "Novembre",
      channel: "linkedin_invite",
    }),
    row(null, "message_sent", "2026-11-05T09:00:00Z", { source: "manual" }),
  ];

  const REPORTED: readonly CampaignReport[] = [
    { key: "lemlist:L1", status: "paused", leads: 12, leadsLaunched: 9 },
  ];

  it("réunit les deux origines, chacune nommée", () => {
    const lines = boardLines(rows, rows, PERIOD, [], [], NOW);
    const keys = lines.map((line) => line.key);
    expect(keys).toContain("lemlist:L1");
    expect(keys).toContain("crm:k1");
    expect(keys).toContain("hors-campagne");
    const lemlist = lines.find((line) => line.key === "lemlist:L1");
    expect(lemlist?.origin).toBe("lemlist");
    expect(lemlist?.label).toBe("Novembre (lemlist)");
  });

  /**
   * **Les invitations comptent dans « messages ».** C'est la définition de
   * `messagesSent` depuis le jalon 109, et l'écran le dit en une ligne : sans
   * la note, l'écart avec le nombre d'emails partis serait mis sur le dos d'un
   * bug.
   */
  it("compte les invitations dans les messages, et les nomme à part", () => {
    const lines = boardLines(rows, rows, PERIOD, [], [], NOW);
    const lemlist = lines.find((line) => line.key === "lemlist:L1");
    expect(lemlist?.messages).toBe(2);
    expect(lemlist?.invites).toBe(1);
  });

  it("garde « hors campagne » comme une ligne, pour que la somme retombe", () => {
    const lines = boardLines(rows, rows, PERIOD, [], [], NOW);
    const none = lines.find((line) => line.key === "hors-campagne");
    // Une ligne sans fiche compte dans « messages » et dans aucun indicateur
    // par personne : la règle du jalon 112, et c'est ce qu'on vérifie ici.
    expect(none?.messages).toBe(1);
    expect(none?.people).toEqual([]);
  });

  it("marque « terminée » une campagne du CRM archivée", () => {
    const lines = boardLines(rows, rows, PERIOD, ["crm:k1"], [], NOW);
    expect(lines.find((line) => line.key === "crm:k1")?.state).toBe("done");
  });

  it("trie par volume de messages : la ligne la plus travaillée d'abord", () => {
    const lines = boardLines(rows, rows, PERIOD, [], [], NOW);
    expect(lines[0]?.key).toBe("lemlist:L1");
  });

  /**
   * **Une invitation acceptée n'est pas une réponse.** Elle a sa colonne, et
   * elle ne touche ni « Réponses » ni le taux : la mélanger ferait monter ce
   * dernier sans qu'un seul message ait été lu.
   */
  it("compte les invitations acceptées à part, sans toucher au taux", () => {
    const lines = boardLines(rows, rows, PERIOD, [], [], NOW);
    const lemlist = lines.find((line) => line.key === "lemlist:L1");
    expect(lemlist?.invitesAccepted).toBe(1);
    expect(lemlist?.replies).toBe(1);
    expect(lemlist?.messages).toBe(2);
  });

  it("porte l'état relevé, le compte en attente et la phrase de pause", () => {
    const lines = boardLines(rows, rows, PERIOD, [], REPORTED, NOW);
    const lemlist = lines.find((line) => line.key === "lemlist:L1");
    expect(lemlist?.state).toBe("paused");
    expect(lemlist?.reportedState).toBe(true);
    expect(lemlist?.waiting).toBe(3);
    expect(lemlist?.notice).toBe("Campagne en pause : 3 prospects attendent d'être lancés");
    // Une campagne sans relevé ne porte ni compte ni phrase, et son état reste
    // une déduction — ce que l'écran dit au survol.
    const crm = lines.find((line) => line.key === "crm:k1");
    expect(crm?.reportedState).toBe(false);
    expect(crm?.waiting).toBeNull();
    expect(crm?.notice).toBeNull();
  });

  it("trie chaque colonne dans les deux sens", () => {
    const base = boardLines(rows, rows, PERIOD, [], [], NOW);
    expect(sortBoard(base, "acceptees", "desc")[0]?.key).toBe("lemlist:L1");
    expect(sortBoard(base, "acceptees", "asc").at(-1)?.key).toBe("lemlist:L1");
    expect(sortBoard(base, "campagne", "asc").map((line) => line.label)).toEqual(
      sortBoard(base, "campagne", "desc")
        .map((line) => line.label)
        .reverse(),
    );
    // Le tri est demandé à `boardLines` lui-même : la vue n'a rien à réordonner.
    expect(boardLines(rows, rows, PERIOD, [], [], NOW, "personnes", "asc")[0]?.people).toEqual([]);
  });

  /**
   * **Un taux absent reste en bas dans les deux sens.** `null` veut dire « rien
   * à convertir » ; inverser le tri ne doit pas en faire le meilleur résultat du
   * tableau — la règle du jalon 30.
   */
  it("range les valeurs absentes en fin, quel que soit le sens", () => {
    const base = boardLines(rows, rows, PERIOD, [], [], NOW);
    expect(sortBoard(base, "taux", "asc").at(-1)?.rate).toBeNull();
    expect(sortBoard(base, "taux", "desc").at(-1)?.rate).toBeNull();
  });

  it("borne les deux réglages de tri lus dans l'URL", () => {
    expect(toBoardSort("acceptees")).toBe("acceptees");
    expect(toBoardSort("n-importe-quoi")).toBe("messages");
    expect(toSortDir("asc")).toBe("asc");
    expect(toSortDir("")).toBe("desc");
  });

  it("fait porter au taux son dénominateur", () => {
    const lines = boardLines(rows, rows, PERIOD, [], [], NOW);
    const lemlist = lines.find((line) => line.key === "lemlist:L1");
    expect(lemlist?.people).toEqual(["a"]);
    expect(lemlist?.rate).toBe(1);
    expect(lemlist?.reliability).toBe("unusable");
  });
});

describe("le résultat par étape", () => {
  const rows = [
    row("a", "message_sent", "2026-11-02T09:00:00Z", { stepIndex: 1, stepType: "email" }),
    row("b", "message_sent", "2026-11-02T09:00:00Z", { stepIndex: 1, stepType: "email" }),
    row("a", "message_sent", "2026-11-05T09:00:00Z", { stepIndex: 2, stepType: "email" }),
    // La réponse ne porte pas d'étape : elle doit tomber sur l'étape 2, le
    // dernier message parti à « a ».
    row("a", "reply_received", "2026-11-06T09:00:00Z"),
    row("c", "message_sent", "2026-11-07T09:00:00Z"),
  ];

  it("donne à chaque étape son propre dénominateur", () => {
    const steps = stepLines(rows);
    const first = steps.find((step) => step.index === 1);
    const second = steps.find((step) => step.index === 2);
    expect(first?.messages).toBe(2);
    expect(first?.contacted).toBe(2);
    // L'étape 2 a touché une personne, et c'est sur une qu'elle se juge — pas
    // sur les deux inscrits de l'étape 1.
    expect(second?.messages).toBe(1);
    expect(second?.contacted).toBe(1);
  });

  it("rattache la réponse à l'étape du dernier message parti", () => {
    const steps = stepLines(rows);
    expect(steps.find((step) => step.index === 1)?.replies).toBe(0);
    expect(steps.find((step) => step.index === 2)?.replies).toBe(1);
    expect(steps.find((step) => step.index === 2)?.rate).toBe(1);
  });

  it("range « hors séquence » en dernier, et le nomme", () => {
    const steps = stepLines(rows);
    expect(steps.map((step) => step.index)).toEqual([1, 2, null]);
    expect(steps[steps.length - 1]?.label).toBe("Hors séquence");
  });

  it("nomme une étape par son rang et son canal", () => {
    expect(stepLabel(2, "linkedin_invite")).toBe("Étape 2 · Invitation LinkedIn");
    // Un type inconnu ne fabrique pas un libellé douteux : le rang suffit.
    expect(stepLabel(3, "quelque-chose")).toBe("Étape 3");
    expect(stepLabel(null, "")).toBe("Hors séquence");
  });
});
