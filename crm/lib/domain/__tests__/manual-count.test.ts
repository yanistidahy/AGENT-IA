import { describe, expect, it } from "vitest";
import {
  MANUAL_CHANNELS,
  MANUAL_SHAPES,
  MAX_BACKDATE_DAYS,
  MAX_BATCH,
  channelOfRow,
  entryIdOf,
  entryPrefix,
  isManualChannel,
  manualCountKey,
  manualShape,
  readEntryDate,
  readQuantity,
  tally,
  tallyTotal,
} from "../manual-count";
import { OUTREACH_CHANNELS, OUTREACH_TYPES } from "../outreach";
import { SENT_TYPES, messagesSent, newlyContacted, peopleMessaged, type EventRow } from "../pilotage";

/**
 * **Le compteur manuel, éprouvé sans base.**
 *
 * Pur : les cinq canaux, ce que chacun écrit, les deux bornes d'une saisie, le
 * regroupement d'un lot, et surtout **l'effet sur les indicateurs** — un
 * message sans fiche compte dans « messages envoyés » et nulle part ailleurs.
 */

describe("les cinq canaux du compteur", () => {
  it("écrivent tous du vocabulaire du jalon 109", () => {
    for (const channel of MANUAL_CHANNELS) {
      const shape = MANUAL_SHAPES[channel];
      expect(OUTREACH_CHANNELS, `${channel} : canal inconnu`).toContain(shape.channel);
      expect(OUTREACH_TYPES, `${channel} : type inconnu`).toContain(shape.type);
      expect(shape.detail.length, `${channel} : détail vide`).toBeGreaterThan(3);
      // Le libellé doit tenir sur un bouton de 390 px de large.
      expect(shape.label.length, `${channel} : libellé trop long`).toBeLessThanOrEqual(22);
    }
  });

  /**
   * **Les cinq comptent comme des messages envoyés**, l'invitation comprise :
   * `SENT_TYPES` réunit `message_sent` et `linkedin_invite_sent`, comme pour
   * lemlist. Si l'un des cinq sortait de cette liste, le bouton compterait
   * dans le vide sans que rien ne rougisse.
   */
  it("entrent tous dans « messages envoyés »", () => {
    for (const channel of MANUAL_CHANNELS) {
      expect(SENT_TYPES, channel).toContain(MANUAL_SHAPES[channel].type);
    }
  });

  /**
   * Une invitation n'est pas un message : le jalon 109 leur a donné deux types
   * exprès, parce que leurs taux d'acceptation n'ont rien à voir.
   */
  it("distinguent l'invitation LinkedIn du message LinkedIn", () => {
    expect(manualShape("linkedin_invite").type).toBe("linkedin_invite_sent");
    expect(manualShape("linkedin_dm").type).toBe("message_sent");
  });

  it("refusent un canal inconnu", () => {
    expect(isManualChannel("linkedin_dm")).toBe(true);
    expect(isManualChannel("telepathie")).toBe(false);
    expect(isManualChannel("")).toBe(false);
  });
});

describe("les bornes d'une saisie", () => {
  /**
   * Refuser plutôt que corriger : un « 0 » ramené à 1 écrirait un message que
   * personne n'a demandé, un « 50 » ramené à 20 en écrirait vingt sans le dire.
   */
  it("refusent une quantité hors bornes au lieu de la corriger", () => {
    expect(readQuantity(1)).toEqual({ ok: true, quantity: 1 });
    expect(readQuantity("5")).toEqual({ ok: true, quantity: 5 });
    expect(readQuantity(MAX_BATCH)).toEqual({ ok: true, quantity: MAX_BATCH });

    for (const bad of [0, -3, MAX_BATCH + 1, 500]) {
      const verdict = readQuantity(bad);
      expect(verdict.ok, String(bad)).toBe(false);
    }
    // Et le refus nomme la borne, pour qu'il indique un geste.
    const tooBig = readQuantity(500);
    expect(tooBig.ok).toBe(false);
    if (!tooBig.ok) expect(tooBig.message).toContain(String(MAX_BATCH));

    for (const bad of ["", "cinq", null, undefined, 1.5]) {
      expect(readQuantity(bad).ok, String(bad)).toBe(false);
    }
  });

  const now = new Date("2026-11-07T15:00:00Z");

  it("acceptent une date absente comme « maintenant »", () => {
    expect(readEntryDate(undefined, now)).toEqual({ ok: true, at: now });
    expect(readEntryDate("", now)).toEqual({ ok: true, at: now });
  });

  it("acceptent la semaine écoulée et refusent au-delà", () => {
    const sixDays = new Date(now.getTime() - 6 * 86_400_000);
    expect(readEntryDate(sixDays.toISOString(), now)).toEqual({ ok: true, at: sixDays });

    const tenDays = new Date(now.getTime() - 10 * 86_400_000);
    const verdict = readEntryDate(tenDays.toISOString(), now);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.message).toContain(String(MAX_BACKDATE_DAYS));
  });

  /**
   * **Compter un message qui n'est pas parti** est le seul mensonge que ce
   * compteur pourrait produire. Une minute de tolérance tout de même :
   * l'horloge d'un téléphone n'est pas celle du serveur.
   */
  it("refusent le futur, à une minute près", () => {
    const soon = new Date(now.getTime() + 30_000);
    expect(readEntryDate(soon.toISOString(), now).ok).toBe(true);

    const tomorrow = new Date(now.getTime() + 86_400_000);
    expect(readEntryDate(tomorrow.toISOString(), now).ok).toBe(false);
  });

  it("refusent une date illisible", () => {
    expect(readEntryDate("pas une date", now).ok).toBe(false);
  });
});

describe("un lot s'annule d'un geste", () => {
  /**
   * Un « +5 » écrit cinq lignes ; « Annuler » doit retirer les cinq. Le lot
   * vit dans le préfixe de l'identifiant externe, donc un `deleteMany` sur ce
   * préfixe défait exactement une saisie.
   */
  it("partage un préfixe entre les lignes d'une même saisie", () => {
    const keys = [0, 1, 2, 3, 4].map((index) => manualCountKey("lot-abc", index));
    expect(new Set(keys).size).toBe(5);
    for (const key of keys) {
      expect(key.startsWith(entryPrefix("lot-abc"))).toBe(true);
      expect(entryIdOf(key)).toBe("lot-abc");
    }
    // Un autre lot ne partage pas le préfixe : annuler l'un ne touche pas
    // l'autre.
    expect(manualCountKey("lot-def", 0).startsWith(entryPrefix("lot-abc"))).toBe(false);
  });

  it("ne reconnaît pas comme lot ce qui ne vient pas du compteur", () => {
    expect(entryIdOf("manual:demo_sent:p1")).toBeNull();
    expect(entryIdOf("send:e1")).toBeNull();
    expect(entryIdOf(null)).toBeNull();
    expect(entryIdOf("manual-count:")).toBeNull();
    expect(entryIdOf("manual-count:sansrang")).toBeNull();
  });
});

describe("le décompte du jour", () => {
  const row = (channel: (typeof MANUAL_CHANNELS)[number]) => ({
    channel: MANUAL_SHAPES[channel].channel,
    type: MANUAL_SHAPES[channel].type,
    detail: MANUAL_SHAPES[channel].detail,
  });

  it("retrouve le canal de saisie de chaque ligne écrite", () => {
    for (const channel of MANUAL_CHANNELS) {
      expect(channelOfRow(row(channel)), channel).toBe(channel);
    }
  });

  /**
   * `instagram_dm` s'écrit sur le canal `other`, parce que les six canaux du
   * jalon 109 sont ceux de lemlist. Le détail est donc la seule trace du vrai
   * canal, et c'est lui qui départage.
   */
  it("départage sur le détail ce que le canal ne distingue pas", () => {
    expect(channelOfRow(row("instagram_dm"))).toBe("instagram_dm");
    // Un autre événement de canal `other` n'est pas un DM Instagram.
    expect(
      channelOfRow({ channel: "other", type: "message_sent", detail: "SMS envoyé" }),
    ).toBeNull();
    // Ni un événement d'un type que le compteur n'écrit pas.
    expect(
      channelOfRow({ channel: "email", type: "message_sent", detail: "Email envoyé" }),
    ).toBeNull();
  });

  /**
   * Les canaux à zéro sont conservés : une ligne qui apparaît et disparaît
   * fait sauter la mise en page sous le bloc, et « 0 appel aujourd'hui » est
   * une information.
   */
  it("garde les cinq canaux, zéros compris, dans l'ordre des boutons", () => {
    const counted = tally([row("linkedin_dm"), row("linkedin_dm"), row("call")]);
    expect(counted.map((entry) => entry.channel)).toEqual([...MANUAL_CHANNELS]);
    expect(counted.find((entry) => entry.channel === "linkedin_dm")?.count).toBe(2);
    expect(counted.find((entry) => entry.channel === "call")?.count).toBe(1);
    expect(counted.find((entry) => entry.channel === "whatsapp")?.count).toBe(0);
    expect(tallyTotal(counted)).toBe(3);
  });

  it("ignore ce qui n'a pas été écrit par le compteur", () => {
    const counted = tally([
      row("whatsapp"),
      { channel: "email", type: "message_sent", detail: "Email envoyé" },
      { channel: "other", type: "other", detail: "Tâche manuelle achevée" },
    ]);
    expect(tallyTotal(counted)).toBe(1);
  });
});

/* ------------------------------------------- l'effet sur les indicateurs --- */

describe("une saisie sans fiche compte dans les messages et nulle part ailleurs", () => {
  let seq = 0;
  function entry(contactId: string | null, channel: (typeof MANUAL_CHANNELS)[number], iso: string): EventRow {
    seq += 1;
    const shape = MANUAL_SHAPES[channel];
    return {
      id: `m${seq}`,
      contactId,
      contactName: contactId === null ? "Sans contact" : contactId,
      companyName: "",
      campaignId: null,
      campaignName: "",
      extCampaignId: "",
      extCampaignName: "",
      channel: shape.channel,
      type: shape.type,
      occurredAt: new Date(iso),
      owner: "Yanis",
      source: "manual",
      replyCategory: "",
      segment: "unknown",
      group: "autre",
    };
  }

  const week = {
    start: new Date("2026-11-02T00:00:00Z"),
    end: new Date("2026-11-09T00:00:00Z"),
    label: "semaine",
  };

  /** Item 1 du test d'acceptation. */
  it("« +1 DM LinkedIn » sans contact : messages +1, nouvelles personnes inchangé", () => {
    const rows = [entry(null, "linkedin_dm", "2026-11-04T10:00:00Z")];
    expect(messagesSent(rows)).toHaveLength(1);
    expect(peopleMessaged(rows)).toEqual([]);
    expect(newlyContacted(rows, week)).toEqual([]);
  });

  /** Item 2 du test d'acceptation. */
  it("« +1 WhatsApp » avec une fiche jamais contactée : messages +1, nouvelles personnes +1", () => {
    const rows = [entry("p1", "whatsapp", "2026-11-04T10:00:00Z")];
    expect(messagesSent(rows)).toHaveLength(1);
    expect(peopleMessaged(rows)).toEqual(["p1"]);
    expect(newlyContacted(rows, week)).toEqual(["p1"]);
  });

  /**
   * Le cas qui compte vraiment : les deux mélangés. Le nombre de messages
   * compte tout, le nombre de personnes ne compte que les fiches — et aucune
   * ligne sans fiche ne vient grossir le dénominateur du taux de réponse.
   */
  it("mélangées, les deux natures ne se contaminent pas", () => {
    const rows = [
      entry(null, "linkedin_dm", "2026-11-03T09:00:00Z"),
      entry(null, "instagram_dm", "2026-11-03T09:30:00Z"),
      entry("p1", "whatsapp", "2026-11-04T10:00:00Z"),
      entry("p1", "call", "2026-11-05T11:00:00Z"),
      entry("p2", "linkedin_invite", "2026-11-05T12:00:00Z"),
    ];
    expect(messagesSent(rows)).toHaveLength(5);
    expect(peopleMessaged(rows)).toEqual(["p1", "p2"]);
    expect(newlyContacted(rows, week).sort()).toEqual(["p1", "p2"]);
  });

  /**
   * **L'invariant du jalon 109, sur des lignes sans fiche.** Le nombre affiché
   * est la longueur de la liste : si les lignes sans fiche étaient écartées de
   * la liste mais comptées dans le total, la pastille mentirait.
   */
  it("une ligne sans fiche reste dans la liste de « messages envoyés »", () => {
    const rows = [
      entry(null, "linkedin_dm", "2026-11-03T09:00:00Z"),
      entry("p1", "whatsapp", "2026-11-04T10:00:00Z"),
    ];
    const listed = messagesSent(rows);
    expect(listed).toHaveLength(2);
    expect(listed.filter((row) => row.contactId === null)).toHaveLength(1);
  });
});
