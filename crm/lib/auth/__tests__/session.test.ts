import { describe, expect, it } from "vitest";
import { constantTimeEqual, issueToken, passwordMatches, verifyToken } from "../session";
import { safeNext } from "../redirect";
import {
  checkRateLimit,
  clearFailures,
  clientKey,
  recordFailure,
  resetRateLimits,
} from "../rate-limit";

const SECRET = "un-mot-de-passe-partage-assez-long";

describe("comparaison à temps constant", () => {
  it("reconnaît l'égalité", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
  });

  it("refuse une longueur différente sans court-circuiter", () => {
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
    expect(constantTimeEqual("", "a")).toBe(false);
  });

  it("refuse une différence au dernier caractère comme au premier", () => {
    expect(constantTimeEqual("abcd", "abce")).toBe(false);
    expect(constantTimeEqual("abcd", "zbcd")).toBe(false);
  });
});

describe("mot de passe", () => {
  it("accepte le bon", async () => {
    expect(await passwordMatches(SECRET, SECRET)).toBe(true);
  });

  it("refuse un préfixe correct", async () => {
    expect(await passwordMatches(SECRET.slice(0, -1), SECRET)).toBe(false);
  });

  it("refuse la chaîne vide", async () => {
    expect(await passwordMatches("", SECRET)).toBe(false);
  });
});

describe("jeton de session", () => {
  it("se vérifie avec la clé qui l'a signé", async () => {
    const token = await issueToken(SECRET, 60);
    expect(await verifyToken(SECRET, token)).toBe(true);
  });

  /**
   * Sans comptes, changer le mot de passe **est** le seul moyen de révoquer un
   * accès. Il faut donc que les sessions existantes tombent avec lui.
   */
  it("changer le mot de passe invalide les sessions en cours", async () => {
    const token = await issueToken(SECRET, 60);
    expect(await verifyToken("nouveau-mot-de-passe", token)).toBe(false);
  });

  it("expire", async () => {
    const token = await issueToken(SECRET, 60, 0);
    expect(await verifyToken(SECRET, token, 61_000)).toBe(false);
    expect(await verifyToken(SECRET, token, 59_000)).toBe(true);
  });

  it("refuse une date d'expiration repoussée à la main", async () => {
    const token = await issueToken(SECRET, 60, 0);
    const parts = token.split(".");
    const forged = `${parts[0]}.${Number(parts[1]) + 10_000_000}.${parts[2]}`;
    expect(await verifyToken(SECRET, forged)).toBe(false);
  });

  it("refuse ce qui n'a pas la forme d'un jeton", async () => {
    for (const value of [undefined, "", "abc", "v1.123", "v2.123.signature"]) {
      expect(await verifyToken(SECRET, value), String(value)).toBe(false);
    }
  });
});

describe("limitation des tentatives", () => {
  it("laisse passer les premières, bloque au-delà du plafond", () => {
    resetRateLimits();
    expect(checkRateLimit("ip").allowed).toBe(true);

    for (let i = 0; i < 8; i += 1) recordFailure("ip");

    const blocked = checkRateLimit("ip");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("ne compte que les échecs : une réussite remet à zéro", () => {
    resetRateLimits();
    for (let i = 0; i < 8; i += 1) recordFailure("ip");
    clearFailures("ip");
    expect(checkRateLimit("ip").allowed).toBe(true);
  });

  it("compte par adresse, pas globalement", () => {
    resetRateLimits();
    for (let i = 0; i < 8; i += 1) recordFailure("ip-a");
    expect(checkRateLimit("ip-b").allowed).toBe(true);
  });

  it("rouvre après la fenêtre", () => {
    resetRateLimits();
    const start = 1_000_000;
    for (let i = 0; i < 8; i += 1) recordFailure("ip", start);
    expect(checkRateLimit("ip", start).allowed).toBe(false);
    expect(checkRateLimit("ip", start + 16 * 60 * 1000).allowed).toBe(true);
  });

  it("lit l'adresse derrière le proxy", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe(
      "203.0.113.7",
    );
    expect(clientKey(new Headers())).toBe("inconnu");
  });
});

describe("destination après connexion", () => {
  it("garde un chemin relatif", () => {
    expect(safeNext("/contacts?filter=reminder")).toBe("/contacts?filter=reminder");
  });

  /** Sans ce filtre, la page de connexion devient un tremplin de redirection. */
  it("refuse tout ce qui mène ailleurs", () => {
    for (const hostile of [
      "https://exemple-malveillant.test/",
      "//exemple-malveillant.test",
      "/\\exemple-malveillant.test",
      "javascript:alert(1)",
      null,
      undefined,
      "",
    ]) {
      expect(safeNext(hostile), String(hostile)).toBe("/");
    }
  });
});
