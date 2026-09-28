import { describe, expect, it } from "vitest";
import {
  bodyWithoutSignature,
  describeResync,
  hasResyncNews,
  emptyDepartureRefusal,
  emptyDepartureReason,
  isStaleDeparture,
  templateFingerprint,
} from "../departure-content";
import { isDemoContact, isReservedEmail, isSeedId } from "../demo-data";

const SIGNATURE = "Yanis Tidahy\nFondateur, Aura Flow AI\n07 85 28 35 36";
const BLOCKS = [SIGNATURE, "Yanis Tidahy\nFondateur, Aura Flow AI"];

describe("« vide » n'est pas « la chaîne est vide »", () => {
  it("un corps réduit à la signature est vide", () => {
    // Le cas mesuré avant ce jalon : trois lignes non vides, acceptées par le
    // seul contrôle existant, et le destinataire a reçu une signature seule.
    expect(emptyDepartureReason({ subject: "Objet", body: SIGNATURE }, BLOCKS)).toBe(
      "aucun message : il ne reste que votre signature",
    );
  });

  it("un objet vide et un message vide se disent séparément", () => {
    // Deux raisons, parce qu'elles ne se corrigent pas au même endroit : un
    // objet manquant se règle sur l'étape ou la variante, un corps sur le texte.
    expect(emptyDepartureReason({ subject: "", body: `Bonjour,\n\n${SIGNATURE}` }, BLOCKS)).toBe(
      "aucun objet",
    );
    expect(emptyDepartureReason({ subject: "  ", body: SIGNATURE }, BLOCKS)).toBe(
      "ni objet ni message : il ne reste que votre signature",
    );
  });

  it("un vrai message n'est jamais refusé", () => {
    const body = `Bonjour Anna,\n\nUne phrase qui dit quelque chose.\n\n${SIGNATURE}`;
    expect(emptyDepartureReason({ subject: "Objet", body }, BLOCKS)).toBeNull();
  });

  it("le refus nomme la cause et le geste", () => {
    const message = emptyDepartureRefusal("aucun objet");
    expect(message).toContain("aucun objet");
    expect(message).toContain("rien n'est parti");
    expect(message).toContain("réécrivez ce départ");
  });
});

describe("le retrait de signature est ancré en fin de texte", () => {
  it("un post-scriptum n'est pas mutilé", () => {
    const body = `Bonjour,\n\n${SIGNATURE}\n\nPS : je serai absent lundi.`;
    // La signature n'est pas en fin : on ne coupe rien, et le message reste
    // non vide — c'est la prudence de `replaceSignature` (jalon 35).
    expect(bodyWithoutSignature(body, BLOCKS)).toContain("PS : je serai absent lundi.");
  });

  it("deux signatures l'une sous l'autre partent toutes les deux", () => {
    // Un brouillon composé avant le jalon 67 peut en porter deux : n'en retirer
    // qu'une laisserait le départ paraître rempli alors qu'il ne dit rien.
    expect(bodyWithoutSignature(`${SIGNATURE}\n\n${SIGNATURE}`, BLOCKS)).toBe("");
  });
});

describe("l'empreinte du gabarit", () => {
  const step = {
    mode: "manual",
    subject: "Objet {marque}",
    body: "Bonjour {prenom},",
    variants: [
      { group: "direction", subject: "A", body: "B" },
      { group: "marketing", subject: "C", body: "D" },
    ],
  };

  it("ne dépend pas de l'ordre de lecture des variantes", () => {
    const reversed = { ...step, variants: [...step.variants].reverse() };
    // Deux lectures qui rendent les variantes dans un ordre différent décrivent
    // le même gabarit : en faire deux empreintes ferait passer pour périmés des
    // départs qui ne le sont pas.
    expect(templateFingerprint(reversed)).toBe(templateFingerprint(step));
  });

  it("change dès qu'un texte change", () => {
    expect(templateFingerprint({ ...step, body: "Bonjour {prenom} !" })).not.toBe(
      templateFingerprint(step),
    );
    expect(
      templateFingerprint({
        ...step,
        variants: [{ group: "direction", subject: "A", body: "autre" }, step.variants[1]!],
      }),
    ).not.toBe(templateFingerprint(step));
  });

  it("une empreinte vide vaut « on ne sait pas », jamais « périmé »", () => {
    // Tous les départs composés avant ce jalon en portent une : les déclarer
    // périmés allumerait un avertissement sur toute la file au premier
    // déploiement, et une alerte qui sonne partout n'est plus lue (jalon 62).
    expect(isStaleDeparture("", "quoi que ce soit")).toBe(false);
    expect(isStaleDeparture("a", "a")).toBe(false);
    expect(isStaleDeparture("a", "b")).toBe(true);
  });
});

describe("une fiche de démonstration se reconnaît à un fait", () => {
  it("les identifiants du jeu de démonstration", () => {
    expect(isSeedId("p12")).toBe(true);
    expect(isSeedId("c1")).toBe(true);
    // Un `cuid` de fiche réelle, jamais.
    expect(isSeedId("cmuldvak000007dkjspz3yu9w")).toBe(false);
  });

  it("les domaines réservés aux essais, et eux seuls", () => {
    expect(isReservedEmail("anna@marque.test")).toBe(true);
    expect(isReservedEmail("anna@example.com")).toBe(true);
    // Le cas signalé : une vraie adresse professionnelle.
    expect(isReservedEmail("stephanie@acomodo.fr")).toBe(false);
    expect(isReservedEmail("sans-arobase")).toBe(false);
  });

  it("une vraie fiche sans site n'est pas une fiche de démonstration", () => {
    // C'est le défaut exact : « Données de démonstration » s'affichait dès
    // qu'aucun site n'était connu, donc sur de vrais prospects.
    expect(
      isDemoContact({ id: "cmuldvak000007dkjspz3yu9w", email: "stephanie@acomodo.fr" }),
    ).toBe(false);
    expect(isDemoContact({ id: "p3", email: "sophie@poussenature.fr" })).toBe(true);
  });
});

describe("le rapport de resynchronisation", () => {
  it("dit les trois nombres, et le pluriel suit", () => {
    // La phrase de la demande, au caractère près : les trois nombres ne
    // s'additionnent pas parce qu'ils ne s'engagent pas sur la même chose.
    expect(
      describeResync({ updated: 15, created: 2, kept: 1, blocked: null }),
    ).toBe("15 départs mis à jour · 2 créés · 1 conservé (retouché à la main)");
    expect(describeResync({ updated: 1, created: 1, kept: 0, blocked: null })).toBe(
      "1 départ mis à jour · 1 créé",
    );
    expect(describeResync({ updated: 0, created: 0, kept: 3, blocked: null })).toBe(
      "0 départ mis à jour · 0 créé · 3 conservés (retouchés à la main)",
    );
  });

  it("le blocage de création se dit à la suite, sans effacer les mises à jour", () => {
    // Le week-end et la pause empêchent la **création**, jamais la réécriture :
    // réécrire un texte n'est pas l'envoyer, et taire les 4 mises à jour ferait
    // croire que l'enregistrement n'a rien fait.
    expect(
      describeResync({ updated: 4, created: 0, kept: 0, blocked: "Samedi : rien n'a été composé." }),
    ).toBe("4 départs mis à jour · 0 créé. Samedi : rien n'a été composé.");
  });

  it("un rapport sans nouvelle ne s'affiche pas", () => {
    // Une campagne entièrement rédigée par Alex n'a rien à resynchroniser :
    // annoncer « 0 départ mis à jour » à chaque enregistrement serait du bruit,
    // et on cesserait de lire la ligne qui compte (jalon 62).
    expect(hasResyncNews({ updated: 0, created: 0, kept: 0, blocked: null })).toBe(false);
    expect(hasResyncNews({ updated: 0, created: 0, kept: 1, blocked: null })).toBe(true);
    expect(hasResyncNews({ updated: 1, created: 0, kept: 0, blocked: null })).toBe(true);
    expect(hasResyncNews({ updated: 0, created: 2, kept: 0, blocked: null })).toBe(true);
  });
});
