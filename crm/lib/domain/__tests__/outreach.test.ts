import { describe, expect, it } from "vitest";
import {
  CHANNEL_LABELS,
  OUTREACH_CHANNELS,
  OUTREACH_SOURCES,
  OUTREACH_TYPES,
  REPLY_CATEGORIES,
  REPLY_CATEGORY_LABELS,
  SOURCE_LABELS,
  TYPE_LABELS,
  UNCATEGORISED_LABEL,
  isOutreachChannel,
  isOutreachSource,
  isOutreachType,
  isPositiveReply,
  isReplyCategory,
  replyCategoryLabel,
  toChannel,
} from "../outreach";

/**
 * Le vocabulaire du journal de prospection.
 *
 * Ce sont des `String` en base (pas d'`enum` Prisma : la règle du projet), donc
 * la frontière `string` → union passe par ces gardes. Un libellé manquant
 * afficherait `undefined` dans une pastille, et une valeur inconnue acceptée
 * ferait compter un événement dans aucune catégorie **sans le dire**.
 */
describe("canaux", () => {
  it("porte un libellé pour chaque canal, et aucun vide", () => {
    for (const channel of OUTREACH_CHANNELS) {
      expect(CHANNEL_LABELS[channel], channel).toBeTruthy();
    }
  });

  it("reconnaît les six canaux et refuse le reste", () => {
    expect(isOutreachChannel("linkedin_invite")).toBe(true);
    expect(isOutreachChannel("instagram")).toBe(false);
    expect(isOutreachChannel("")).toBe(false);
  });

  /**
   * **Un canal inconnu devient « autre », il ne devient pas « email ».**
   *
   * Instagram est un vrai canal du produit (jalon 48) sans colonne dédiée dans
   * le vocabulaire de lemlist : il atterrit dans « autre », où il est compté,
   * plutôt que dans un canal qu'il n'est pas — ce qui gonflerait les emails.
   */
  it("range l'inconnu dans « autre » plutôt que de le deviner", () => {
    expect(toChannel("instagram")).toBe("other");
    expect(toChannel("")).toBe("other");
    expect(toChannel("email")).toBe("email");
  });
});

describe("types d'événement", () => {
  it("porte les douze types demandés, chacun avec un libellé", () => {
    for (const required of [
      "message_sent",
      "linkedin_invite_sent",
      "linkedin_invite_accepted",
      "reply_received",
      "bounce",
      "demo_sent",
      "demo_tested",
      "feedback_received",
      "meeting_booked",
      "meeting_held",
      "trial_started",
      "customer_won",
    ]) {
      expect(OUTREACH_TYPES as readonly string[], required).toContain(required);
      expect(isOutreachType(required), required).toBe(true);
    }
    for (const type of OUTREACH_TYPES) {
      expect(TYPE_LABELS[type], type).toBeTruthy();
    }
  });

  it("refuse un type qui n'existe pas", () => {
    expect(isOutreachType("email_opened")).toBe(false);
  });
});

describe("sources", () => {
  it("nomme les trois sources, lemlist comprise", () => {
    expect([...OUTREACH_SOURCES]).toEqual(["crm", "lemlist", "manual"]);
    for (const source of OUTREACH_SOURCES) expect(SOURCE_LABELS[source], source).toBeTruthy();
    expect(isOutreachSource("zapier")).toBe(false);
  });
});

describe("catégories de réponse", () => {
  it("porte les sept catégories demandées", () => {
    expect([...REPLY_CATEGORIES]).toEqual([
      "interested",
      "not_now",
      "not_interested",
      "already_equipped",
      "wrong_person",
      "unsubscribe",
      "out_of_office",
    ]);
    for (const category of REPLY_CATEGORIES) {
      expect(REPLY_CATEGORY_LABELS[category], category).toBeTruthy();
    }
  });

  /**
   * **Une seule catégorie est positive.** « Pas maintenant » est une réponse,
   * et c'est même une bonne nouvelle relative — mais la compter comme positive
   * gonflerait le seul chiffre sur lequel on décide d'insister.
   */
  it("ne tient pour positive que « intéressé »", () => {
    expect(isPositiveReply("interested")).toBe(true);
    for (const category of REPLY_CATEGORIES) {
      if (category === "interested") continue;
      expect(isPositiveReply(category), category).toBe(false);
    }
  });

  it("ne devine rien d'une catégorie vide ou inconnue", () => {
    expect(isPositiveReply("")).toBe(false);
    expect(isPositiveReply("peut-être")).toBe(false);
    expect(isReplyCategory("")).toBe(false);
  });

  /**
   * Une réponse sans catégorie se **nomme**. Afficher une chaîne vide la
   * ferait passer pour une donnée manquante à l'affichage, alors que c'est un
   * état du produit : personne ne l'a encore lue.
   */
  it("nomme l'absence de catégorie au lieu de rendre du vide", () => {
    expect(replyCategoryLabel("")).toBe(UNCATEGORISED_LABEL);
    expect(replyCategoryLabel("   ")).toBe(UNCATEGORISED_LABEL);
    expect(replyCategoryLabel("inconnu")).toBe(UNCATEGORISED_LABEL);
    expect(replyCategoryLabel("not_now")).toBe(REPLY_CATEGORY_LABELS.not_now);
  });
});
