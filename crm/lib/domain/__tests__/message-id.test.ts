import { describe, expect, it } from "vitest";
import { messageId } from "@/lib/api/mail";
import { anyOursMissing, idDomain, judgeCitedId, looksOurs } from "../message-id";

/**
 * **La garde de la cause du jalon 44.**
 *
 * `messageId()` est la seule fabrique d'identifiants du produit, et
 * `looksOurs()` doit reconnaître ce qu'elle produit. Les deux sont vérifiées
 * l'une contre l'autre plutôt que contre une chaîne recopiée : une forme
 * recopiée dans le test cesserait de décrire le générateur au premier
 * changement, et le diagnostic redeviendrait muet sans que rien n'échoue.
 */
describe("reconnaître un identifiant que nous avons fabriqué", () => {
  const ours = messageId("contact@auraflowai.fr", new Date("2026-08-17T10:33:22Z"), "rpp6m071");

  it("reconnaît ce que le générateur du produit vient de produire", () => {
    expect(looksOurs(ours, "auraflowai.fr")).toBe(true);
  });

  it("reconnaît l'identifiant réellement cité en production", () => {
    // Relevé dans la boîte de réception : notre format, notre domaine, et
    // pourtant absent de `email_sends` — c'est le fait qui a nommé la cause.
    expect(looksOurs("<1787142802796.rpp6m071@auraflowai.fr>", "auraflowai.fr")).toBe(true);
  });

  it("refuse l'identifiant fabriqué par nodemailer", () => {
    // La forme UUID de `mime-node`, celle qui était stockée à tort.
    expect(looksOurs("<b58ba737-b4c6-c1a8-3bda-dd2f97989d06@auraflowai.fr>", "auraflowai.fr")).toBe(
      false,
    );
  });

  it("refuse un autre domaine, même à la bonne forme", () => {
    expect(looksOurs("<1787142802796.rpp6m071@miye.care>", "auraflowai.fr")).toBe(false);
  });

  it("refuse une forme étrangère sur notre domaine", () => {
    expect(looksOurs("<CAF=abc123@auraflowai.fr>", "auraflowai.fr")).toBe(false);
  });

  it("ne revendique rien quand le domaine d'expédition est inconnu", () => {
    // Sans domaine configuré, tout identifiant deviendrait « des nôtres » et le
    // diagnostic accuserait la base à chaque lettre d'information reçue.
    expect(looksOurs(ours, "")).toBe(false);
  });

  it("lit le domaine, casse comprise", () => {
    expect(idDomain("<x.y@AuraFlowAI.FR>")).toBe("auraflowai.fr");
    expect(idDomain("sans-arobase")).toBe("");
  });
});

describe("le verdict distingue « inconnu » de « des nôtres, absent »", () => {
  const known = new Set(["<1787000000000.aaaa@auraflowai.fr>"]);
  const judge = (id: string) => judgeCitedId(id, known, "auraflowai.fr").kind;

  it("un identifiant en base est une réponse", () => {
    expect(judge("<1787000000000.aaaa@auraflowai.fr>")).toBe("known");
  });

  it("notre domaine et notre forme, hors base → la base est en cause", () => {
    expect(judge("<1787142802796.rpp6m071@auraflowai.fr>")).toBe("ours-missing");
  });

  it("un fil étranger reste un fil étranger", () => {
    expect(judge("<CAF=xyz@mail.gmail.com>")).toBe("foreign");
  });

  it("un seul des nôtres suffit à basculer le diagnostic d'un message", () => {
    // `References` cite tout le fil : le nôtre peut être noyé parmi d'autres.
    const cited = ["<a@mail.gmail.com>", "<1787142802796.rpp6m071@auraflowai.fr>", "<b@ailleurs.fr>"];
    expect(anyOursMissing(cited, known, "auraflowai.fr")).toBe(true);
    expect(anyOursMissing(["<a@mail.gmail.com>"], known, "auraflowai.fr")).toBe(false);
  });
});
