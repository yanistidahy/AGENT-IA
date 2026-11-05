import { describe, expect, it, vi } from "vitest";
import {
  categoryForOutcome,
  eventForActivity,
  recordOutreachEvent,
} from "../outreach-events";
import { ACTIVITY_TYPES } from "../../domain/types";
import { isOutreachChannel, isOutreachType } from "../../domain/outreach";

/**
 * L'écriture du journal de prospection, et les deux règles qui la gouvernent.
 *
 * Les deux défauts qu'elle évite sont invisibles à l'œil : un **double compte**
 * (chaque email envoyé laisse deux traces en base depuis le jalon 32) et un
 * **doublon de synchronisation** (deux passages lemlist posant le même
 * identifiant). Aucun des deux ne lèverait, ne ferait rougir un type, ni ne
 * s'afficherait comme une erreur — ils rendraient simplement un chiffre faux.
 */

describe("un email ne se compte qu'une fois", () => {
  /**
   * **La règle qui structure tout le module.** Un email envoyé depuis le CRM
   * écrit une ligne dans `email_sends` **et** une interaction de type `email`.
   * Écrire un événement des deux côtés doublerait chaque message — faux de
   * 100 %, et sans rien pour le signaler.
   */
  it("ne produit aucun événement pour une interaction de type email", () => {
    expect(eventForActivity("email")).toBeNull();
  });

  /** Une note n'est pas une touche : elle ne consigne aucun travail sortant. */
  it("ne produit aucun événement pour une note", () => {
    expect(eventForActivity("note")).toBeNull();
  });

  it("couvre les sept types d'interaction, sans en oublier un en silence", () => {
    for (const type of ACTIVITY_TYPES) {
      const shape = eventForActivity(type);
      if (shape === null) continue;
      expect(isOutreachChannel(shape.channel), type).toBe(true);
      expect(isOutreachType(shape.type), type).toBe(true);
    }
  });

  it("range un appel, un message LinkedIn et un DM dans des canaux distincts", () => {
    expect(eventForActivity("call")?.channel).toBe("call");
    expect(eventForActivity("linkedin")?.channel).toBe("linkedin_message");
    // Instagram n'est pas un canal du vocabulaire de lemlist : il va dans
    // « autre » **et le dit**, au lieu d'être compté comme un email.
    expect(eventForActivity("instagram")?.channel).toBe("other");
    expect(eventForActivity("instagram")?.detail).toContain("Instagram");
  });

  it("compte une réunion et une démo comme des rendez-vous tenus", () => {
    expect(eventForActivity("meeting")?.type).toBe("meeting_held");
    expect(eventForActivity("demo")?.type).toBe("meeting_held");
  });
});

describe("la catégorie d'une réponse est traduite, jamais devinée", () => {
  it("fait correspondre les issues saisies aux catégories", () => {
    expect(categoryForOutcome("interested")).toBe("interested");
    expect(categoryForOutcome("later")).toBe("not_now");
    expect(categoryForOutcome("not-interested")).toBe("not_interested");
    expect(categoryForOutcome("wrong-person")).toBe("wrong_person");
    expect(categoryForOutcome("meeting")).toBe("interested");
  });

  /**
   * **`replied` reste sans catégorie.** Le relevé IMAP ne lit que des en-têtes
   * (jalon 41) : il sait qu'il y a une réponse, et rien de plus. Lui attribuer
   * une couleur serait l'invention que ce jalon refuse.
   */
  it("laisse sans catégorie une réponse dont on ne sait rien", () => {
    expect(categoryForOutcome("replied")).toBe("");
    expect(categoryForOutcome("no-answer")).toBe("");
    expect(categoryForOutcome("")).toBe("");
  });
});

describe("deux fois le même identifiant de source font un seul événement", () => {
  const input = {
    contactId: "c1",
    channel: "email" as const,
    type: "message_sent" as const,
    occurredAt: new Date("2026-11-05T09:00:00Z"),
    source: "lemlist" as const,
    externalId: "lml-42",
  };

  /**
   * **La base tranche, pas une vérification applicative.** C'est la posture
   * d'`autoKey` (jalon 8) : deux appels simultanés contournent toujours un
   * « est-ce que ça existe déjà ? », jamais une contrainte d'unicité. L'erreur
   * `P2002` est donc **avalée** — un second passage de synchronisation doit
   * produire une ligne, pas une erreur qui interromprait le reste.
   */
  it("avale le doublon au lieu de lever, et le dit par son retour", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({ id: "e1" })
      .mockRejectedValueOnce(Object.assign(new Error("Unique constraint"), { code: "P2002" }));
    const writer = { outreachEvent: { create } } as unknown as Parameters<
      typeof recordOutreachEvent
    >[0];

    expect(await recordOutreachEvent(writer, input)).toBe(true);
    expect(await recordOutreachEvent(writer, input)).toBe(false);
    expect(create).toHaveBeenCalledTimes(2);
  });

  /** Toute autre erreur remonte : avaler un échec de base serait pire. */
  it("ne masque pas une autre erreur", async () => {
    const create = vi.fn().mockRejectedValue(new Error("connexion perdue"));
    const writer = { outreachEvent: { create } } as unknown as Parameters<
      typeof recordOutreachEvent
    >[0];

    await expect(recordOutreachEvent(writer, input)).rejects.toThrow("connexion perdue");
  });

  it("pose les valeurs par défaut sans laisser de nul là où le schéma attend une chaîne", async () => {
    const create = vi.fn().mockResolvedValue({ id: "e1" });
    const writer = { outreachEvent: { create } } as unknown as Parameters<
      typeof recordOutreachEvent
    >[0];

    await recordOutreachEvent(writer, {
      contactId: "c1",
      channel: "call",
      type: "message_sent",
      occurredAt: new Date("2026-11-05T09:00:00Z"),
    });

    const data = create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.source).toBe("crm");
    expect(data.owner).toBe("");
    expect(data.replyCategory).toBe("");
    expect(data.detail).toBe("");
    expect(data.externalId).toBeNull();
    expect(data.campaignId).toBeNull();
  });
});
