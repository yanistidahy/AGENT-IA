import { describe, expect, it } from "vitest";
import {
  BURST_WINDOW_SECONDS,
  DELIVERY_WINDOW_SECONDS,
  classifyOpenHit,
  countsAsOpen,
  noiseShare,
} from "../open-tracking";

const SENT = new Date("2026-08-20T09:00:00Z");
const at = (seconds: number) => new Date(SENT.getTime() + seconds * 1000);

describe("un chargement à la livraison n'est pas une lecture", () => {
  it("écarte ce qui arrive dans la fenêtre de livraison", () => {
    const verdict = classifyOpenHit({ sentAt: SENT, lastHitAt: null, now: at(2) });
    expect(verdict.kind).toBe("delivery");
    expect(verdict.delaySeconds).toBe(2);
  });

  it("la borne est exclusive : à la seconde du seuil, on compte", () => {
    expect(
      classifyOpenHit({ sentAt: SENT, lastHitAt: null, now: at(DELIVERY_WINDOW_SECONDS - 1) }).kind,
    ).toBe("delivery");
    expect(
      classifyOpenHit({ sentAt: SENT, lastHitAt: null, now: at(DELIVERY_WINDOW_SECONDS) }).kind,
    ).toBe("counted");
  });

  it("la livraison passe avant la rafale : un seul libellé pour un phénomène", () => {
    const verdict = classifyOpenHit({ sentAt: SENT, lastHitAt: at(1), now: at(3) });
    expect(verdict.kind).toBe("delivery");
  });
});

describe("un client qui recharge n'ouvre pas deux fois", () => {
  it("écarte un second chargement rapproché", () => {
    const verdict = classifyOpenHit({ sentAt: SENT, lastHitAt: at(3600), now: at(3610) });
    expect(verdict.kind).toBe("burst");
    expect(verdict.delaySeconds).toBe(3610);
  });

  it("compte une relecture au-delà de la fenêtre", () => {
    const later = 3600 + BURST_WINDOW_SECONDS;
    expect(classifyOpenHit({ sentAt: SENT, lastHitAt: at(3600), now: at(later) }).kind).toBe(
      "counted",
    );
  });

  it("le premier chargement au-delà de la livraison est compté", () => {
    expect(classifyOpenHit({ sentAt: SENT, lastHitAt: null, now: at(600) }).kind).toBe("counted");
  });
});

describe("les horloges qui reculent ne cassent rien", () => {
  it("un délai négatif est ramené à zéro, et le chargement est une livraison", () => {
    const verdict = classifyOpenHit({ sentAt: SENT, lastHitAt: null, now: at(-120) });
    expect(verdict.delaySeconds).toBe(0);
    expect(verdict.kind).toBe("delivery");
  });

  it("un chargement antérieur au précédent ne devient pas une rafale", () => {
    // Sans la borne `sinceLast >= 0`, un horodatage désordonné produirait un
    // écart négatif, donc « inférieur à la fenêtre », donc une rafale.
    expect(classifyOpenHit({ sentAt: SENT, lastHitAt: at(7200), now: at(3600) }).kind).toBe(
      "counted",
    );
  });
});

describe("un seul compteur bouge par chargement", () => {
  it("seul « counted » compte comme ouverture", () => {
    expect(countsAsOpen("counted")).toBe(true);
    expect(countsAsOpen("burst")).toBe(false);
    expect(countsAsOpen("delivery")).toBe(false);
  });
});

describe("la part de bruit", () => {
  it("se calcule sur l'ensemble des chargements", () => {
    expect(noiseShare(2, 6).noiseRate).toBeCloseTo(0.75);
  });

  it("n'existe pas sans chargement", () => {
    expect(noiseShare(0, 0).noiseRate).toBeNull();
  });
});
