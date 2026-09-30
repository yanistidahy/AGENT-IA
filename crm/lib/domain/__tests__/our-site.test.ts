import { describe, expect, it } from "vitest";
import {
  DEFAULT_OUR_SITE_URL,
  ourSiteLabel,
  ourSiteLink,
  splitOurSiteLink,
} from "../our-site";
import { renderSubject, renderTemplate, type MergeValues } from "../merge-tags";
import { withOurSiteLink } from "../email-format";

const VALUES: MergeValues = {
  prenom: "Anna",
  nom: "Roux",
  fonction: "Fondatrice",
  societe: "Maison Vertu",
  site: "maisonvertu.fr",
  video: "",
  notresite: DEFAULT_OUR_SITE_URL,
};

describe("le libellé est dérivé de l'adresse, jamais saisi à côté", () => {
  it("retire le scheme et la barre finale, et rien d'autre", () => {
    expect(ourSiteLabel("https://auraflowai.fr/")).toBe("auraflowai.fr");
    expect(ourSiteLabel("http://www.auraflowai.fr")).toBe("www.auraflowai.fr");
    expect(ourSiteLabel("https://auraflowai.fr/demo")).toBe("auraflowai.fr/demo");
  });

  it("n'accepte que http et https : une adresse exécutable ne se rend pas cliquable", () => {
    expect(ourSiteLink("javascript:alert(1)")).toBeNull();
    expect(ourSiteLink("auraflowai.fr")).toBeNull();
    expect(ourSiteLink("")).toBeNull();
    expect(ourSiteLink("https://")).toBeNull();
  });

  it("rend l'adresse au caractère près, et son libellé", () => {
    expect(ourSiteLink("  https://auraflowai.fr/  ")).toEqual({
      url: "https://auraflowai.fr/",
      label: "auraflowai.fr",
    });
  });
});

describe("{notresite} substitue l'adresse entière", () => {
  it("le texte porte l'adressse complète, sans développement", () => {
    const out = renderTemplate("Découvrez notre solution sur {notresite}.", VALUES);
    expect(out).toBe("Découvrez notre solution sur https://auraflowai.fr/.");
    expect(out).not.toContain("{notresite}");
  });

  /*
    **Dans un objet, c'est le libellé, pas l'adresse** — décision du jalon 101,
    qui renverse ce que ce test fixait. Une URL entière dans un `Subject:` ne se
    clique pas, occupe la place du sujet, et se lit comme du démarchage en
    masse. Le corps, lui, garde l'adresse complète : c'est là qu'on la copie.
  */
  it("l'objet rend le libellé, le corps l'adresse entière", () => {
    expect(renderSubject("Voir {notresite}", VALUES)).toBe("Voir auraflowai.fr");
    expect(renderTemplate("Voir {notresite}.", VALUES)).toBe("Voir https://auraflowai.fr/.");
  });

  it("sans adresse réglée, la phrase entière disparaît", () => {
    const out = renderTemplate("Bonjour {prenom}. Voyez {notresite}. À bientôt.", {
      ...VALUES,
      notresite: "",
    });
    expect(out).not.toContain("{notresite}");
    expect(out).not.toContain("Voyez");
    expect(out).toContain("Bonjour Anna.");
  });
});

describe("l'ancre HTML est posée à l'envoi, une seule fois", () => {
  const site = ourSiteLink(DEFAULT_OUR_SITE_URL);

  it("le visible est le libellé, la cible est l'adresse réglée", () => {
    const html = withOurSiteLink(
      "<p>Voyez https://auraflowai.fr/ aujourd'hui.</p>",
      site ?? undefined,
    );
    expect(html).toContain('<a href="https://auraflowai.fr/">auraflowai.fr</a>');
  });

  it("aucune redirection, aucun paramètre, aucun compteur dans le href", () => {
    const html = withOurSiteLink("<p>https://auraflowai.fr/</p>", site ?? undefined);
    const href = /href="([^"]+)"/.exec(html)?.[1] ?? "";
    expect(href).toBe(DEFAULT_OUR_SITE_URL);
    expect(href).not.toContain("?");
    expect(href).not.toContain("/api/l/");
    expect(href).not.toContain("utm");
  });

  it("sans adresse, le HTML ne bouge pas", () => {
    expect(withOurSiteLink("<p>rien</p>", undefined)).toBe("<p>rien</p>");
  });
});

describe("l'aperçu découpe, il ne substitue rien", () => {
  it("rend le libellé et l'adresse de la même source que l'envoi", () => {
    const parts = splitOurSiteLink(
      "Voyez https://auraflowai.fr/ aujourd'hui.",
      ourSiteLink(DEFAULT_OUR_SITE_URL),
    );
    expect(parts.before).toBe("Voyez ");
    expect(parts.link?.label).toBe("auraflowai.fr");
    expect(parts.after).toBe(" aujourd'hui.");
  });

  it("sans occurrence, tout reste du texte", () => {
    const parts = splitOurSiteLink("rien ici", ourSiteLink(DEFAULT_OUR_SITE_URL));
    expect(parts.link).toBeNull();
    expect(parts.before).toBe("rien ici");
  });
});
