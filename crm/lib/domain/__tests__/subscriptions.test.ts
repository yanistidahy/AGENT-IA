import { describe, expect, it } from "vitest";
import {
  MAX_AMOUNT_CENTS,
  MIN_AMOUNT_CENTS,
  SUBSCRIPTION_STATUSES,
  centsFromMollieAmount,
  decideWebhookAction,
  escapeHtml,
  firstChargeDate,
  isMolliePaymentId,
  isPlausibleToken,
  isSubscriptionStatus,
  mollieAmount,
  parseEuroInput,
} from "../subscriptions";

describe("mollieAmount", () => {
  it("écrit les centimes comme une chaîne à deux décimales", () => {
    expect(mollieAmount(8000)).toBe("80.00");
    expect(mollieAmount(8050)).toBe("80.50");
    expect(mollieAmount(5)).toBe("0.05");
    expect(mollieAmount(100)).toBe("1.00");
    expect(mollieAmount(123456)).toBe("1234.56");
  });

  it("refuse ce qui n'est pas un entier positif", () => {
    expect(() => mollieAmount(80.5)).toThrow();
    expect(() => mollieAmount(-1)).toThrow();
    expect(() => mollieAmount(Number.NaN)).toThrow();
  });
});

describe("centsFromMollieAmount", () => {
  it("relit exactement ce que mollieAmount écrit", () => {
    for (const cents of [100, 1, 8000, 8050, 99999, 500000]) {
      expect(centsFromMollieAmount(mollieAmount(cents))).toBe(cents);
    }
  });

  it("ne devine rien sur une forme inattendue", () => {
    expect(centsFromMollieAmount("80")).toBeNull();
    expect(centsFromMollieAmount("80.5")).toBeNull();
    expect(centsFromMollieAmount("80,00")).toBeNull();
    expect(centsFromMollieAmount(80)).toBeNull();
    expect(centsFromMollieAmount(null)).toBeNull();
  });
});

describe("parseEuroInput", () => {
  it("accepte virgule, point et espaces", () => {
    expect(parseEuroInput("80")).toBe(8000);
    expect(parseEuroInput("80,5")).toBe(8050);
    expect(parseEuroInput("80.50")).toBe(8050);
    expect(parseEuroInput(" 1 200,00 ")).toBe(120000);
    expect(parseEuroInput("19,99")).toBe(1999);
  });

  it("refuse l'illisible, les trois décimales et les bornes", () => {
    expect(parseEuroInput("")).toBeNull();
    expect(parseEuroInput("abc")).toBeNull();
    expect(parseEuroInput("80,999")).toBeNull();
    expect(parseEuroInput("-80")).toBeNull();
    expect(parseEuroInput("0,50")).toBeNull();
    expect(parseEuroInput("5001")).toBeNull();
    expect(parseEuroInput("1")).toBe(MIN_AMOUNT_CENTS);
    expect(parseEuroInput("5000")).toBe(MAX_AMOUNT_CENTS);
  });
});

describe("firstChargeDate", () => {
  it("ajoute un mois, au même quantième", () => {
    expect(firstChargeDate(new Date("2026-11-12T10:00:00Z"))).toBe("2026-12-12");
    expect(firstChargeDate(new Date("2026-01-05T10:00:00Z"))).toBe("2026-02-05");
  });

  it("passe l'année en décembre", () => {
    expect(firstChargeDate(new Date("2026-12-15T10:00:00Z"))).toBe("2027-01-15");
  });

  it("retombe sur le dernier jour d'un mois plus court", () => {
    expect(firstChargeDate(new Date("2026-01-31T10:00:00Z"))).toBe("2026-02-28");
    // 2028 est bissextile.
    expect(firstChargeDate(new Date("2028-01-31T10:00:00Z"))).toBe("2028-02-29");
    expect(firstChargeDate(new Date("2026-03-31T10:00:00Z"))).toBe("2026-04-30");
  });

  it("compte au calendrier de Paris, pas à celui de l'UTC", () => {
    // 23 h 30 UTC le 30 novembre = 00 h 30 le 1er décembre à Paris (UTC+1).
    expect(firstChargeDate(new Date("2026-11-30T23:30:00Z"))).toBe("2027-01-01");
    // 22 h 30 UTC le 30 juin = 00 h 30 le 1er juillet à Paris (UTC+2).
    expect(firstChargeDate(new Date("2026-06-30T22:30:00Z"))).toBe("2026-08-01");
  });
});

describe("decideWebhookAction", () => {
  const pending = { status: "pending", mollieSubscriptionId: null } as const;
  const active = { status: "active", mollieSubscriptionId: "sub_abc" } as const;

  it("crée l'abonnement au premier paiement confirmé, une seule fois", () => {
    expect(decideWebhookAction({ status: "paid", sequenceType: "first" }, pending)).toBe("activate");
    expect(decideWebhookAction({ status: "paid", sequenceType: "first" }, active)).toBe(
      "already_activated",
    );
  });

  it("note un premier paiement raté sans tuer le lien", () => {
    for (const status of ["failed", "canceled", "expired"]) {
      expect(decideWebhookAction({ status, sequenceType: "first" }, pending)).toBe("note_only");
    }
  });

  it("enregistre les prélèvements mensuels, réussis ou non", () => {
    expect(decideWebhookAction({ status: "paid", sequenceType: "recurring" }, active)).toBe(
      "record_paid",
    );
    for (const status of ["failed", "canceled", "expired"]) {
      expect(decideWebhookAction({ status, sequenceType: "recurring" }, active)).toBe(
        "record_failed",
      );
    }
  });

  it("attend tant que le paiement est ouvert", () => {
    for (const status of ["open", "pending", "authorized"]) {
      expect(decideWebhookAction({ status, sequenceType: "first" }, pending)).toBe("wait");
    }
  });

  it("ne rouvre jamais un abonnement annulé", () => {
    const canceled = { status: "canceled", mollieSubscriptionId: "sub_abc" } as const;
    for (const status of ["paid", "failed", "open"]) {
      for (const sequenceType of ["first", "recurring"]) {
        expect(decideWebhookAction({ status, sequenceType }, canceled)).toBe("ignore");
      }
    }
  });

  it("ignore un paiement ponctuel", () => {
    expect(decideWebhookAction({ status: "paid", sequenceType: "oneoff" }, active)).toBe("ignore");
  });
});

describe("identifiants", () => {
  it("reconnaît un jeton de 43 caractères base64url", () => {
    expect(isPlausibleToken("A".repeat(43))).toBe(true);
    expect(isPlausibleToken("a-_".repeat(14) + "a")).toBe(true);
    expect(isPlausibleToken("A".repeat(42))).toBe(false);
    expect(isPlausibleToken("A".repeat(44))).toBe(false);
    expect(isPlausibleToken("A".repeat(42) + "=")).toBe(false);
    expect(isPlausibleToken("")).toBe(false);
  });

  it("reconnaît un identifiant de paiement Mollie", () => {
    expect(isMolliePaymentId("tr_WDqYK6vllg")).toBe(true);
    expect(isMolliePaymentId("sub_abc123")).toBe(false);
    expect(isMolliePaymentId("tr_")).toBe(false);
    expect(isMolliePaymentId("tr_abc/../x")).toBe(false);
    expect(isMolliePaymentId("")).toBe(false);
  });

  it("ne connaît que les quatre statuts", () => {
    expect([...SUBSCRIPTION_STATUSES]).toEqual(["pending", "active", "past_due", "canceled"]);
    expect(isSubscriptionStatus("active")).toBe(true);
    expect(isSubscriptionStatus("paused")).toBe(false);
  });
});

describe("escapeHtml", () => {
  it("neutralise ce qui ouvrirait une balise ou un attribut", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
    expect(escapeHtml("L'Atelier & Fils")).toBe("L&#39;Atelier &amp; Fils");
  });
});
