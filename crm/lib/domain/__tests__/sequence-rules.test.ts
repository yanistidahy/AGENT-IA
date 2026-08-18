import { describe, expect, it } from "vitest";
import {
  AUTO_MIN_REPLIES,
  AUTO_MIN_VALIDATED,
  autoAllowedForStep,
  autoUnlock,
  BLOCK_LABELS,
  canSendAutomatically,
  isWeekend,
  MAX_STEPS,
  nextStep,
  stopsEnrollment,
  type SequenceContact,
} from "../sequence-rules";
import { DO_NOT_CONTACT } from "../lost";

/**
 * **La sécurité d'une séquence tient à ce module.**
 *
 * Un envoi automatique est la moins réversible des écritures du produit :
 * personne ne rattrape un courriel parti. Ces tests fixent les quatre refus qui
 * comptent, et surtout le fait qu'aucun d'eux ne dépend d'un écran.
 */

const OK: SequenceContact = { lifecycle: "Prospect", lostReason: "", email: "a@b.fr" };
const STEPS = [
  { position: 1, delayDays: 0 },
  { position: 2, delayDays: 4 },
  { position: 3, delayDays: 7 },
];
const FRESH = { repliedAt: null, lastSentAt: null, lastStep: 0 };
/** Un mardi. */
const TUESDAY = new Date(2026, 7, 18, 9);

describe("qui a le droit de recevoir la prochaine étape", () => {
  it("laisse passer un prospect ordinaire", () => {
    expect(nextStep(OK, FRESH, STEPS, TUESDAY)).toEqual({ ok: true, step: 1 });
  });

  it("**la réponse arrête tout**, avant même le délai", () => {
    // C'est la seule sécurité du système tant que la détection est manuelle.
    const replied = { ...FRESH, repliedAt: new Date(2026, 7, 17) };
    expect(nextStep(OK, replied, STEPS, TUESDAY)).toEqual({ ok: false, reason: "replied" });
  });

  it("refuse une fiche close et une opposition au démarchage", () => {
    expect(nextStep({ ...OK, lifecycle: "Perdu" }, FRESH, STEPS, TUESDAY)).toEqual({
      ok: false,
      reason: "terminal",
    });
    expect(nextStep({ ...OK, lifecycle: "Ancien Client" }, FRESH, STEPS, TUESDAY)).toEqual({
      ok: false,
      reason: "terminal",
    });
    // L'opposition ferme vaut **quel que soit le cycle de vie** — règle du
    // jalon 10, et elle survit ici parce qu'elle est testée séparément.
    expect(
      nextStep({ ...OK, lifecycle: "Prospect", lostReason: DO_NOT_CONTACT }, FRESH, STEPS, TUESDAY),
    ).toEqual({ ok: false, reason: "optout" });
  });

  it("refuse une fiche sans adresse", () => {
    expect(nextStep({ ...OK, email: "  " }, FRESH, STEPS, TUESDAY)).toEqual({
      ok: false,
      reason: "no-email",
    });
  });

  it("**ne compose rien le samedi ni le dimanche**", () => {
    const saturday = new Date(2026, 7, 22, 9);
    const sunday = new Date(2026, 7, 23, 9);
    expect(isWeekend(saturday)).toBe(true);
    expect(isWeekend(sunday)).toBe(true);
    expect(isWeekend(TUESDAY)).toBe(false);
    expect(nextStep(OK, FRESH, STEPS, saturday)).toEqual({ ok: false, reason: "weekend" });
    expect(nextStep(OK, FRESH, STEPS, sunday)).toEqual({ ok: false, reason: "weekend" });
  });

  it("attend le délai, compté depuis le dernier envoi", () => {
    const sentMonday = { repliedAt: null, lastSentAt: new Date(2026, 7, 17), lastStep: 1 };
    // Étape 2 à J+4 : le mardi, il est trop tôt.
    expect(nextStep(OK, sentMonday, STEPS, TUESDAY)).toEqual({ ok: false, reason: "too-soon" });
    // Le vendredi suivant, c'est bon.
    expect(nextStep(OK, sentMonday, STEPS, new Date(2026, 7, 21, 9))).toEqual({
      ok: true,
      step: 2,
    });
  });

  it("s'arrête au bout de trois étapes", () => {
    const done = { repliedAt: null, lastSentAt: new Date(2026, 6, 1), lastStep: MAX_STEPS };
    expect(nextStep(OK, done, STEPS, TUESDAY)).toEqual({ ok: false, reason: "finished" });
  });

  it("distingue ce qui arrête l'inscription de ce qui la met en pause", () => {
    // Un refus qui arrête doit écrire un motif sur l'inscription ; un refus qui
    // met en pause ne doit surtout pas la fermer — sinon un délai non écoulé
    // tuerait la séquence.
    for (const reason of ["terminal", "optout", "no-email", "replied", "finished"] as const) {
      expect(stopsEnrollment(reason), reason).toBe(true);
    }
    for (const reason of ["too-soon", "weekend"] as const) {
      expect(stopsEnrollment(reason), reason).toBe(false);
    }
  });

  it("chaque motif porte une phrase lisible", () => {
    // C'est ce qu'on lira dans six mois pour comprendre pourquoi une séquence
    // s'est arrêtée. Un code technique n'apprendrait rien.
    for (const label of Object.values(BLOCK_LABELS)) {
      expect(label.length).toBeGreaterThan(10);
    }
  });
});

describe("le verrou du mode automatique", () => {
  it("**la première étape ne part jamais toute seule**", () => {
    expect(autoAllowedForStep(1)).toBe(false);
    expect(autoAllowedForStep(2)).toBe(true);
    expect(autoAllowedForStep(3)).toBe(true);

    // Même déverrouillé et activé, l'étape 1 reste manuelle.
    const open = autoUnlock(100, 10);
    expect(open.unlocked).toBe(true);
    expect(canSendAutomatically(1, true, open)).toBe(false);
    expect(canSendAutomatically(2, true, open)).toBe(true);
  });

  it("exige les deux conditions, pas une seule", () => {
    // Vingt validations sans une seule réponse : la séquence a été tolérée, pas
    // éprouvée. C'est le durcissement demandé.
    const tolerated = autoUnlock(AUTO_MIN_VALIDATED, 0);
    expect(tolerated.unlocked).toBe(false);
    expect(tolerated.reason).toContain("au moins une réponse");

    const tooFew = autoUnlock(3, AUTO_MIN_REPLIES);
    expect(tooFew.unlocked).toBe(false);
    expect(tooFew.reason).toContain("17 départs validés");

    expect(autoUnlock(AUTO_MIN_VALIDATED, AUTO_MIN_REPLIES).unlocked).toBe(true);
  });

  it("dit ce qui manque, jamais seulement « indisponible »", () => {
    const locked = autoUnlock(0, 0);
    expect(locked.reason).toContain("20 départs");
    expect(locked.reason).toContain("réponse");
  });

  it("l'interrupteur ne suffit pas : les conditions sont un fait, pas une intention", () => {
    const locked = autoUnlock(2, 0);
    expect(canSendAutomatically(2, true, locked)).toBe(false);
    // Et réciproquement : déverrouillé mais interrupteur éteint = manuel.
    expect(canSendAutomatically(2, false, autoUnlock(50, 5))).toBe(false);
  });
});
