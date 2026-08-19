import { describe, expect, it } from "vitest";
import {
  classify,
  extractMessageIds,
  isAutoResponse,
  isBounce,
  type InboxHeaders,
} from "../inbox-replies";

/**
 * **Une fausse correspondance est pire qu'une réponse manquée.**
 *
 * Une réponse manquée coûte un relevé de retard sur la saisie manuelle ; une
 * fausse correspondance consigne une réponse sur la mauvaise fiche et arrête la
 * mauvaise séquence. Ces tests fixent donc surtout ce que le relevé **refuse**
 * de reconnaître.
 */

const OURS = "<1787063966791.wwgrjicb@aura.test>";
const KNOWN = new Set([OURS, "<autre.envoi@aura.test>"]);

function headers(patch: Partial<InboxHeaders> = {}): InboxHeaders {
  return {
    messageId: "<reponse-1@prospect.fr>",
    inReplyTo: "",
    references: "",
    autoSubmitted: "",
    xAutoreply: "",
    from: "Laure Favre <laure@prospect.fr>",
    date: new Date(2026, 7, 19, 10),
    ...patch,
  };
}

describe("l'extraction des identifiants", () => {
  it("lit un identifiant simple et une liste", () => {
    expect(extractMessageIds("<a@b.fr>")).toEqual(["<a@b.fr>"]);
    expect(extractMessageIds("<a@b.fr> <c@d.fr>\r\n <e@f.fr>")).toEqual([
      "<a@b.fr>",
      "<c@d.fr>",
      "<e@f.fr>",
    ]);
  });

  it("ignore ce qui n'a pas la forme d'un message-id", () => {
    // Un en-tête malformé ne doit pas fabriquer une correspondance.
    expect(extractMessageIds("")).toEqual([]);
    expect(extractMessageIds("pas un identifiant")).toEqual([]);
    expect(extractMessageIds("<sans-arobase>")).toEqual([]);
  });
});

describe("ce qui n'est pas une réponse", () => {
  it("**écarte un répondeur d'absence même s'il cite nos en-têtes**", () => {
    // C'est le cas qui mord : un « absent du bureau » recopie fidèlement
    // `In-Reply-To`, donc la correspondance serait parfaite. Compté comme
    // réponse, il arrêterait une séquence pour un message que personne n'a lu.
    const away = headers({ inReplyTo: OURS, autoSubmitted: "auto-replied" });
    expect(isAutoResponse(away)).toBe(true);
    expect(classify(away, KNOWN)).toEqual({ kind: "auto" });

    expect(classify(headers({ inReplyTo: OURS, xAutoreply: "yes" }), KNOWN)).toEqual({
      kind: "auto",
    });
  });

  it("« Auto-Submitted: no » désigne un humain — la RFC 3834 l'exige", () => {
    expect(isAutoResponse({ autoSubmitted: "no", xAutoreply: "" })).toBe(false);
    expect(classify(headers({ inReplyTo: OURS, autoSubmitted: "no" }), KNOWN)).toEqual({
      kind: "reply",
      matchedId: OURS,
    });
  });

  it("écarte un rebond, qui vient du serveur et non du destinataire", () => {
    const bounce = headers({ from: "MAILER-DAEMON@ionos.fr", references: OURS });
    expect(isBounce(bounce)).toBe(true);
    expect(classify(bounce, KNOWN)).toEqual({ kind: "bounce" });
    expect(classify(headers({ from: "postmaster@ionos.fr", references: OURS }), KNOWN).kind).toBe(
      "bounce",
    );
  });

  it("**ne devine jamais depuis l'expéditeur ni le sujet**", () => {
    // Un message de la bonne personne, sans en-tête de fil : ce n'est pas une
    // réponse à un message identifié, et l'attribuer serait une heuristique.
    expect(classify(headers({ from: "laure@prospect.fr" }), KNOWN)).toEqual({ kind: "unrelated" });
  });

  it("un identifiant qui n'est pas des nôtres ne correspond pas", () => {
    const other = headers({ inReplyTo: "<un-message@ailleurs.fr>" });
    expect(classify(other, KNOWN)).toEqual({ kind: "unrelated" });
  });
});

describe("ce qui est une réponse", () => {
  it("reconnaît In-Reply-To", () => {
    expect(classify(headers({ inReplyTo: OURS }), KNOWN)).toEqual({
      kind: "reply",
      matchedId: OURS,
    });
  });

  it("reconnaît References quand In-Reply-To manque", () => {
    // Certains clients ne posent que `References`.
    expect(classify(headers({ references: `<vieux@ailleurs.fr> ${OURS}` }), KNOWN)).toEqual({
      kind: "reply",
      matchedId: OURS,
    });
  });

  it("**retient le message le plus récent du fil**, pas le premier", () => {
    // Dans un fil de trois échanges, `References` remonte du plus ancien au
    // plus récent : c'est au dernier des nôtres que la personne répond, et
    // c'est lui qui doit dater la correspondance.
    const thread = headers({
      references: `<vieux@ailleurs.fr> <autre.envoi@aura.test> ${OURS}`,
    });
    expect(classify(thread, KNOWN)).toEqual({ kind: "reply", matchedId: OURS });
  });

  it("In-Reply-To l'emporte sur References", () => {
    const both = headers({ inReplyTo: "<autre.envoi@aura.test>", references: OURS });
    expect(classify(both, KNOWN)).toEqual({ kind: "reply", matchedId: "<autre.envoi@aura.test>" });
  });

  it("sans envoi connu, aucune correspondance possible", () => {
    expect(classify(headers({ inReplyTo: OURS }), new Set())).toEqual({ kind: "unrelated" });
  });
});
