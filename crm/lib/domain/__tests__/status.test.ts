import { describe, expect, it } from "vitest";
import {
  isStale,
  nameOverflow,
  OUTCOMES,
  proposalFor,
  resolveStatus,
  splitOverflow,
  STATUS_SUGGESTIONS,
} from "../status";
import { FOLLOW_UP_LABELS } from "../follow-up";

describe("statut résolu", () => {
  /** La garantie qui protège les fiches importées : sans saisie, rien ne change. */
  it("retombe sur le calcul quand rien n'est saisi", () => {
    const resolved = resolveStatus({ status: "", followUp: "silent" });
    expect(resolved.label).toBe(FOLLOW_UP_LABELS.silent);
    expect(resolved.source).toBe("computed");
    expect(resolved.attention).toBe(true);
  });

  it("une chaîne d'espaces ne compte pas comme une saisie", () => {
    expect(resolveStatus({ status: "   ", followUp: "never" }).source).toBe("computed");
  });

  it("le statut saisi l'emporte sur le calcul", () => {
    const resolved = resolveStatus({ status: "RDV pris", followUp: "silent" });
    expect(resolved.label).toBe("RDV pris");
    expect(resolved.source).toBe("stored");
    // « Sans nouvelles » appelait l'attention ; « RDV pris » non. La saisie gagne.
    expect(resolved.attention).toBe(false);
  });

  it("certains statuts saisis appellent l'attention", () => {
    expect(resolveStatus({ status: "Ne répond plus", followUp: "waiting" }).attention).toBe(true);
    expect(resolveStatus({ status: FOLLOW_UP_LABELS.due, followUp: "waiting" }).attention).toBe(true);
  });

  /**
   * Un libellé libre est inconnu du domaine : lui inventer une urgence à partir
   * d'un mot qu'on ne comprend pas serait pire que de n'en signaler aucune.
   */
  it("un libellé personnalisé n'invente pas d'urgence", () => {
    expect(resolveStatus({ status: "Rappeler la DAF", followUp: "due" }).attention).toBe(false);
  });
});

describe("statut figé", () => {
  const t = (iso: string) => new Date(iso);

  it("un statut jamais saisi n'est pas figé", () => {
    expect(isStale({ status: "", statusSetAt: null, lastActivityAt: t("2026-08-01") })).toBe(false);
  });

  it("est figé quand une interaction est postérieure au statut", () => {
    expect(
      isStale({
        status: "Intéressé",
        statusSetAt: t("2026-07-01"),
        lastActivityAt: t("2026-08-01"),
      }),
    ).toBe(true);
  });

  it("n'est pas figé quand le statut suit l'interaction", () => {
    expect(
      isStale({
        status: "Intéressé",
        statusSetAt: t("2026-08-02"),
        lastActivityAt: t("2026-08-01"),
      }),
    ).toBe(false);
  });

  it("sans interaction, rien n'est figé", () => {
    expect(isStale({ status: "Intéressé", statusSetAt: t("2026-07-01"), lastActivityAt: null })).toBe(
      false,
    );
  });
});

describe("propositions par issue", () => {
  it("chaque issue propose un statut", () => {
    for (const outcome of OUTCOMES) {
      expect(proposalFor(outcome).status, outcome).not.toBe("");
    }
  });

  it("« RDV obtenu » fait passer en Prospect", () => {
    const proposal = proposalFor("meeting");
    expect(proposal.lifecycle).toBe("Prospect");
    expect(proposal.status).toBe("RDV pris");
  });

  it("« pas intéressé » passe en Perdu, demande le motif et efface la relance", () => {
    const proposal = proposalFor("not-interested");
    expect(proposal.lifecycle).toBe("Perdu");
    expect(proposal.needsLostReason).toBe(true);
    expect(proposal.clearReminder).toBe(true);
  });

  it("« à relancer plus tard » amène le curseur sur l'échéance", () => {
    const proposal = proposalFor("later");
    expect(proposal.focusReminder).toBe(true);
    expect(proposal.clearReminder).toBe(false);
    expect(proposal.lifecycle).toBeNull();
  });

  /** Aucune issue ne doit à la fois demander une date et l'effacer. */
  it("aucune proposition ne se contredit", () => {
    for (const outcome of OUTCOMES) {
      const proposal = proposalFor(outcome);
      expect(proposal.focusReminder && proposal.clearReminder, outcome).toBe(false);
    }
  });

  it("les statuts proposés figurent dans les suggestions, sauf « Perdu »", () => {
    for (const outcome of OUTCOMES) {
      const { status } = proposalFor(outcome);
      if (status === "Perdu") continue;
      expect(STATUS_SUGGESTIONS, outcome).toContain(status);
    }
  });
});

describe("noms débordés à l'import", () => {
  const long = "Alexandra Alexandra herrau, mais possible numéro de son équipe";

  it("repère une virgule et une longueur anormale", () => {
    expect(nameOverflow(long)).toBe(true);
    expect(nameOverflow("Durand")).toBe(false);
    expect(nameOverflow("Marie-Christine de La Rochefoucauld-Montbazon")).toBe(true);
  });

  it("coupe à la virgule — la frontière que la personne a écrite", () => {
    const { kept, moved } = splitOverflow(long);
    expect(kept).toBe("Alexandra Alexandra herrau");
    expect(moved).toBe("mais possible numéro de son équipe");
  });

  it("à défaut de virgule, coupe au dernier espace avant la limite", () => {
    const { kept, moved } = splitOverflow(
      "Jean Baptiste Emmanuel de la Tour du Pin Chambly Verclause",
    );
    expect(kept.length).toBeLessThanOrEqual(40);
    expect(kept.endsWith(" ")).toBe(false);
    expect(`${kept} ${moved}`.replace(/\s+/g, " ")).toBe(
      "Jean Baptiste Emmanuel de la Tour du Pin Chambly Verclause",
    );
  });

  it("laisse intact un nom normal", () => {
    expect(splitOverflow("Durand")).toEqual({ kept: "Durand", moved: "" });
  });
});
