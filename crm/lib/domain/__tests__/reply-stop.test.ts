import { describe, expect, it } from "vitest";
import {
  SENDING_ENROLLMENT_STATUS,
  departureBlocksSend,
  enrollmentBlocksSend,
  latestReply,
  replyFloor,
  stateRefusal,
} from "../reply-stop";

/**
 * Les faits qui arrêtent une relance.
 *
 * Les deux premiers blocs portent les défauts **mesurés** au jalon 106 : une
 * réponse datée 328 ms avant l'envoi auquel elle répond, et un état d'arrêt que
 * l'envoi ne lisait pas.
 */

describe("la borne d'une recherche de réponse", () => {
  it("tombe à la seconde, parce que l'en-tête Date: n'a pas de millisecondes", () => {
    // Le cas exact de la recette : envoi à .328, réponse datée pile à la seconde.
    const sent = new Date("2026-10-06T15:32:53.328Z");
    const replied = new Date("2026-10-06T15:32:53.000Z");

    expect(replied.getTime() > sent.getTime(), "l'ancienne borne ne la voyait pas").toBe(false);
    expect(replied.getTime() >= (replyFloor(sent) as Date).getTime()).toBe(true);
  });

  it("n'élargit pas d'une seconde de plus que ce que le format impose", () => {
    const sent = new Date("2026-10-06T15:32:53.000Z");
    // Une interaction d'une seconde avant reste antérieure : ce serait une
    // conversation d'avant l'envoi, pas une réponse.
    const before = new Date("2026-10-06T15:32:52.000Z");
    expect(before.getTime() >= (replyFloor(sent) as Date).getTime()).toBe(false);
  });

  it("sans point de départ, il n'y a pas de borne", () => {
    expect(replyFloor(null)).toBeNull();
  });
});

describe("les deux sources de réponse", () => {
  const early = new Date("2026-10-01T09:00:00Z");
  const late = new Date("2026-10-02T09:00:00Z");

  it("la détection du relevé compte même sans interaction consignée", () => {
    // Le cas de la fiche rattachée après coup (jalon 45) : `EmailReply` existe,
    // l'interaction non.
    expect(latestReply(null, late)).toBe(late);
  });

  it("l'interaction compte même sans détection, c'est la saisie à la main", () => {
    expect(latestReply(late, null)).toBe(late);
  });

  it("la plus récente l'emporte, dans les deux ordres", () => {
    expect(latestReply(early, late)).toBe(late);
    expect(latestReply(late, early)).toBe(late);
  });

  it("aucune des deux : aucune réponse", () => {
    expect(latestReply(null, null)).toBeNull();
  });
});

describe("les états qui ne partent plus", () => {
  it("seule une inscription active envoie", () => {
    expect(enrollmentBlocksSend(SENDING_ENROLLMENT_STATUS)).toBe(false);
    for (const status of ["stopped", "done", "removed", ""]) {
      expect(enrollmentBlocksSend(status), status).toBe(true);
    }
  });

  it("un départ écarté ou parti ne part plus, un brouillon non composé reste réécrivable", () => {
    expect(departureBlocksSend("pending")).toBe(false);
    expect(departureBlocksSend("failed")).toBe(false);
    expect(departureBlocksSend("skipped")).toBe(true);
    expect(departureBlocksSend("sent")).toBe(true);
  });

  it("le refus nomme le motif enregistré, parce qu'un refus muet se lit comme une panne", () => {
    const refusal = stateRefusal("stopped", "Le contact a répondu", "pending");
    expect(refusal).toContain("Le contact a répondu");
    expect(refusal).toContain("n'est plus active");
  });

  it("sans motif, il dit l'état plutôt que d'inventer une raison", () => {
    const refusal = stateRefusal("removed", "", "pending");
    expect(refusal).toContain("n'est plus active");
    expect(refusal).not.toContain("undefined");
  });

  it("le départ écarté passe devant : c'est lui qu'on vient d'essayer d'envoyer", () => {
    expect(stateRefusal("active", "", "skipped")).toContain("retiré de la file");
  });

  it("rien ne refuse un départ en attente sous une inscription active", () => {
    expect(stateRefusal("active", "", "pending")).toBeNull();
  });
});
