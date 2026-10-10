import { describe, expect, it } from "vitest";
import {
  DERIVED_HEADERS,
  EXPORT_HEADERS,
  IMPORT_HEADERS,
  contactMeans,
  formatDayFr,
  originFromHeaders,
  recordLink,
  stepLabel,
  yesNo,
} from "../contact-export";
import { neutralize, toCsv } from "../csv";

describe("la forme du fichier", () => {
  it("les deux blocs se suivent, sans recouvrement", () => {
    expect(EXPORT_HEADERS).toEqual([...IMPORT_HEADERS, ...DERIVED_HEADERS]);
    for (const derived of DERIVED_HEADERS) {
      expect(IMPORT_HEADERS as readonly string[], derived).not.toContain(derived);
    }
  });

  it("chaque en-tête est unique : une colonne en double se lirait de travers", () => {
    expect(new Set(EXPORT_HEADERS).size).toBe(EXPORT_HEADERS.length);
  });

  it("les colonnes demandées par le jalon sont toutes là", () => {
    for (const column of [
      "Prénom", "Nom", "Email", "Téléphone", "Instagram", "Société", "Site",
      "Groupe de fonction", "Fonction", "Statut de relance", "Dernier contact",
      "Dernier canal", "Campagne en cours", "Étape de séquence", "A répondu",
      "Prospect chaud", "Moyens de contact disponibles", "Lien vers la fiche",
    ]) {
      expect(EXPORT_HEADERS, column).toContain(column);
    }
  });
});

describe("les dates", () => {
  it("s'écrivent en JJ/MM/AAAA, le format qu'Excel français lit comme une date", () => {
    expect(formatDayFr(new Date(2026, 1, 11, 9, 0))).toBe("11/02/2026");
    expect(formatDayFr(new Date(2026, 11, 1, 23, 30))).toBe("01/12/2026");
  });

  it("une date absente rend une cellule vide, jamais un repère inventé", () => {
    expect(formatDayFr(null)).toBe("");
  });

  it("se lisent en temps local : en UTC, une date du soir reculerait d'un jour", () => {
    // 1er mars à 00h30 à Paris. Rendue en UTC, elle s'écrirait « 28/02 ».
    const evening = new Date(2026, 2, 1, 0, 30);
    expect(formatDayFr(evening)).toBe("01/03/2026");
  });
});

describe("les moyens de contact", () => {
  const means = (over: Record<string, string>) =>
    contactMeans({ email: "", phone: "", instagram: "", linkedin: "", ...over });

  it("listent ce qui permet un geste, dans l'ordre où l'on s'en sert", () => {
    expect(means({ email: "a@b.fr", phone: "06", instagram: "@x", linkedin: "in/x" })).toBe(
      "Email · Téléphone · Instagram · LinkedIn",
    );
  });

  it("une fiche injoignable le dit, plutôt que de rendre une case vide", () => {
    expect(means({})).toBe("aucun");
  });

  it("une valeur réduite à des espaces ne compte pas comme un moyen", () => {
    expect(means({ phone: "   " })).toBe("aucun");
  });
});

describe("l'étape de séquence", () => {
  it("se dit comme l'écran la dit", () => {
    expect(stepLabel(2, 3)).toBe("2 sur 3");
  });

  it("zéro étape envoyée se dit, parce que « 0 » se lirait comme une étape", () => {
    expect(stepLabel(0, 3)).toBe("pas encore écrit (0 sur 3)");
  });

  it("sans séquence, la case reste vide", () => {
    expect(stepLabel(0, 0)).toBe("");
  });
});

describe("le lien vers la fiche", () => {
  it("ouvre la fiche sur l'origine servie", () => {
    expect(recordLink("https://crm.test", "c1")).toBe("https://crm.test/contacts?fiche=c1");
  });

  it("ne double pas la barre oblique", () => {
    expect(recordLink("https://crm.test/", "c1")).toBe("https://crm.test/contacts?fiche=c1");
  });

  it("encode un identifiant exotique plutôt que de casser l'URL", () => {
    expect(recordLink("https://crm.test", "a b&c")).toBe(
      "https://crm.test/contacts?fiche=a%20b%26c",
    );
  });
});

describe("l'origine du lien", () => {
  const origin = (over: Record<string, string> = {}, fb: Record<string, string> = {}) =>
    originFromHeaders(
      { forwardedHost: "", forwardedProto: "", host: "", ...over },
      { publicUrl: "", requestOrigin: "http://0.0.0.0:3312", ...fb },
    );

  it("suit le proxy quand il en pose un", () => {
    expect(origin({ forwardedHost: "crm.auraflowai.fr", forwardedProto: "https" })).toBe(
      "https://crm.auraflowai.fr",
    );
  });

  it("ne garde que le premier hôte d'une chaîne de proxys", () => {
    expect(
      origin({ forwardedHost: "crm.test, interne.test", forwardedProto: "https, http" }),
    ).toBe("https://crm.test");
  });

  it("retombe sur l'hôte demandé, qui est ce que le navigateur a tapé", () => {
    expect(origin({ host: "127.0.0.1:3312" })).toBe("http://127.0.0.1:3312");
  });

  it("puis sur l'adresse publique réglée", () => {
    expect(origin({}, { publicUrl: "https://crm.auraflowai.fr" })).toBe(
      "https://crm.auraflowai.fr",
    );
  });

  it("l'origine de la requête n'est retenue qu'en dernier : elle vaut 0.0.0.0", () => {
    // Le défaut mesuré : le serveur standalone se lie à 0.0.0.0, donc la
    // première version de la colonne exportait un lien qu'on ne peut pas ouvrir.
    expect(origin()).toBe("http://0.0.0.0:3312");
  });

  it("un en-tête vide n'est jamais retenu", () => {
    expect(origin({ forwardedHost: "  ", host: "crm.test" })).toBe("http://crm.test");
  });
});

describe("oui / non", () => {
  it("un seul vocabulaire pour les deux colonnes booléennes", () => {
    expect(yesNo(true)).toBe("oui");
    expect(yesNo(false)).toBe("non");
  });
});

describe("l'injection de formule", () => {
  it("désamorce les quatre caractères qui ouvrent un calcul", () => {
    for (const hostile of ["=1+1", "+1", "-1", "@SUM(A1)"]) {
      expect(neutralize(hostile).startsWith("'"), hostile).toBe(true);
    }
  });

  it("laisse intact tout ce qui n'ouvre pas de formule", () => {
    for (const safe of ["ACME", "Édition Limitée", "06 12 34 56 78", "", "a=b"]) {
      expect(neutralize(safe), safe).toBe(safe);
    }
  });

  it("s'applique au fichier entier, donc aux deux exports", () => {
    // La neutralisation vit dans l'écrivain CSV : l'export des sociétés la reçoit
    // sans avoir à y penser, et une colonne ajoutée demain aussi.
    const csv = toCsv([["Société"], ['=cmd|" /C calc"!A1']]);
    expect(csv).toContain("'=cmd");
    expect(csv.includes("\n=cmd")).toBe(false);
  });

  it("un téléphone international reste lisible et composable", () => {
    expect(neutralize("+33 6 12 34 56 78")).toBe("'+33 6 12 34 56 78");
  });
});
