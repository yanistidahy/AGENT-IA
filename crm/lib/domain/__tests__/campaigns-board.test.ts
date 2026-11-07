import { describe, expect, it } from "vitest";
import {
  QUIET_DAYS,
  boardLines,
  boardState,
  stepLabel,
  stepLines,
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
    expect(boardState({ archived: true, lastFactAt: NOW, now: NOW })).toBe("done");
  });

  it("dit « en cours » tant qu'un fait est récent", () => {
    const recent = new Date(NOW.getTime() - (QUIET_DAYS - 1) * 86_400_000);
    expect(boardState({ archived: false, lastFactAt: recent, now: NOW })).toBe("running");
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
    expect(boardState({ archived: false, lastFactAt: old, now: NOW })).toBe("paused");
    expect(boardState({ archived: false, lastFactAt: null, now: NOW })).toBe("paused");
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
    row(null, "message_sent", "2026-11-05T09:00:00Z", { source: "manual" }),
  ];

  it("réunit les deux origines, chacune nommée", () => {
    const lines = boardLines(rows, rows, PERIOD, [], NOW);
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
    const lines = boardLines(rows, rows, PERIOD, [], NOW);
    const lemlist = lines.find((line) => line.key === "lemlist:L1");
    expect(lemlist?.messages).toBe(2);
    expect(lemlist?.invites).toBe(1);
  });

  it("garde « hors campagne » comme une ligne, pour que la somme retombe", () => {
    const lines = boardLines(rows, rows, PERIOD, [], NOW);
    const none = lines.find((line) => line.key === "hors-campagne");
    // Une ligne sans fiche compte dans « messages » et dans aucun indicateur
    // par personne : la règle du jalon 112, et c'est ce qu'on vérifie ici.
    expect(none?.messages).toBe(1);
    expect(none?.people).toEqual([]);
  });

  it("marque « terminée » une campagne du CRM archivée", () => {
    const lines = boardLines(rows, rows, PERIOD, ["crm:k1"], NOW);
    expect(lines.find((line) => line.key === "crm:k1")?.state).toBe("done");
  });

  it("trie par volume de messages : la ligne la plus travaillée d'abord", () => {
    const lines = boardLines(rows, rows, PERIOD, [], NOW);
    expect(lines[0]?.key).toBe("lemlist:L1");
  });

  it("fait porter au taux son dénominateur", () => {
    const lines = boardLines(rows, rows, PERIOD, [], NOW);
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
