import { describe, expect, it } from "vitest";
import {
  formatSender,
  hasBody,
  paragraphCount,
  sanitizeSubject,
  splitParagraphs,
  toHtml,
  toPlainText,
} from "../email-format";

/**
 * La mise en forme est la partie qui trahit tout le reste.
 *
 * Ces tests fixent ce qui doit survivre du brouillon jusqu'à la boîte de
 * réception. Ils ne remplacent pas la lecture de la source brute d'un message
 * réellement reçu — c'est fait dans la vérification du jalon — mais ils rendent
 * la règle exécutable, donc défendue à chaque commit.
 */
const LETTER = `Bonjour Marc,

Merci pour votre retour de ce matin. Je reviens vers vous comme convenu.

Deux points :
- le délai de livraison
- le prix du pilote

Bien à vous,
Yanis`;

describe("découpage en paragraphes", () => {
  it("sépare sur une ligne vide, pas sur une simple fin de ligne", () => {
    expect(splitParagraphs(LETTER)).toHaveLength(4);
  });

  it("garde les fins de ligne internes d'un paragraphe", () => {
    const blocks = splitParagraphs(LETTER);
    expect(blocks[2]).toBe("Deux points :\n- le délai de livraison\n- le prix du pilote");
    expect(blocks[3]).toBe("Bien à vous,\nYanis");
  });

  it("réduit plusieurs lignes vides à une seule séparation", () => {
    // Trois « entrée » d'affilée traduisent l'intention « nouveau paragraphe »,
    // pas « trois blancs » : les rendre tels quels donnerait un message troué.
    expect(splitParagraphs("Un\n\n\n\nDeux")).toEqual(["Un", "Deux"]);
  });

  it("tolère les fins de ligne Windows", () => {
    expect(splitParagraphs("Un\r\n\r\nDeux")).toEqual(["Un", "Deux"]);
  });

  it("ignore les lignes qui ne contiennent que des espaces", () => {
    // Un « paragraphe » d'espaces vient d'un copier-coller, jamais d'une
    // intention. Sans ce filtre il produirait un <p></p> visible.
    expect(splitParagraphs("Un\n   \nDeux")).toEqual(["Un", "Deux"]);
  });
});

describe("partie texte", () => {
  it("préserve les lignes vides entre paragraphes", () => {
    const plain = toPlainText(LETTER);
    expect(plain).toContain("Bonjour Marc,\n\nMerci pour votre retour");
    expect(plain.split("\n\n")).toHaveLength(4);
  });

  it("ne reformate pas le texte", () => {
    // Aucune coupure à 72 colonnes, aucune retouche : ce qui a été tapé part tel
    // quel. Une ligne longue reste une ligne longue.
    const long = `${"a".repeat(200)}\n\nfin`;
    expect(toPlainText(long)).toBe(`${"a".repeat(200)}\n\nfin`);
  });

  it("rend un texte vide pour un corps blanc", () => {
    expect(toPlainText("   \n\n  ")).toBe("");
    expect(hasBody("   \n\n  ")).toBe(false);
    expect(hasBody(LETTER)).toBe(true);
  });
});

describe("partie HTML", () => {
  it("enveloppe chaque paragraphe dans un <p>", () => {
    const html = toHtml(LETTER);
    expect(html.match(/<p>/g)).toHaveLength(4);
  });

  it("transforme les fins de ligne internes en <br>", () => {
    expect(toHtml("Bien à vous,\nYanis")).toBe("<html><body><p>Bien à vous,<br>Yanis</p></body></html>");
  });

  it("ne porte aucun style, aucune police, aucune couleur", () => {
    const html = toHtml(LETTER);
    for (const forbidden of ["style=", "<style", "font", "color", "<table", "<img", "class="]) {
      expect(html, `le HTML ne doit pas contenir « ${forbidden} »`).not.toContain(forbidden);
    }
  });

  it("échappe ce qui casserait le document", () => {
    expect(toHtml("5 < 10 & \"oui\"")).toContain("<p>5 &lt; 10 &amp; &quot;oui&quot;</p>");
    // Une balise tapée dans le corps est du texte, pas du balisage.
    expect(toHtml("<script>alert(1)</script>")).toContain("&lt;script&gt;");
  });
});

describe("en-têtes", () => {
  it("refuse une injection par le sujet", () => {
    // Le sujet vient d'un champ libre — et d'un modèle. Un retour à la ligne y
    // est une injection d'en-tête, pas un détail d'affichage.
    expect(sanitizeSubject("Bonjour\r\nBcc: tiers@example.com")).toBe(
      "Bonjour Bcc: tiers@example.com",
    );
    expect(sanitizeSubject("  Suite à notre échange  ")).toBe("Suite à notre échange");
  });

  it("compose l'expéditeur avec son nom affiché", () => {
    expect(formatSender("Yanis Tidahy", "yanis@example.com")).toBe(
      '"Yanis Tidahy" <yanis@example.com>',
    );
    expect(formatSender("", "yanis@example.com")).toBe("yanis@example.com");
    expect(formatSender('Yanis "Le" Tidahy', "y@e.com")).toBe('"Yanis  Le  Tidahy" <y@e.com>');
  });
});

describe("les deux parties disent la même chose", () => {
  it("même nombre de paragraphes des deux côtés", () => {
    const cases = [LETTER, "Un seul paragraphe.", "Un\n\nDeux\n\nTrois", "A\nB\n\nC"];
    for (const body of cases) {
      const plainBlocks = toPlainText(body).split("\n\n").filter((b) => b !== "");
      const htmlBlocks = toHtml(body).match(/<p>/g) ?? [];
      expect(htmlBlocks.length, `« ${body.slice(0, 20)}… »`).toBe(plainBlocks.length);
      expect(paragraphCount(body)).toBe(plainBlocks.length);
    }
  });
});


/**
 * Le lien de démonstration : une ancre en HTML, une adresse lisible en texte.
 *
 * Les deux moitiés du problème sont réelles. En HTML, « → Diagnostic offert »
 * seul ne mène nulle part ; en texte brut, une ancre n'existe pas — un client
 * texte affiche le libellé et perd l'adresse. Il faut donc **deux rendus
 * différents du même paragraphe**, et c'est exactement ce qu'une partie
 * `multipart/alternative` permet.
 */
const DEMO = { label: "Diagnostic offert", url: "https://deluxe-fudge-addd15.netlify.app/" };

const AVEC_LIEN = `Bonjour Caroline,

Votre équipe doit gérer un volume important de questions récurrentes.

Pour vous montrer le résultat concret, j'ai préparé une courte démonstration privée → Diagnostic offert

Êtes-vous curieux de tester l'outil de votre côté ?

À bientôt,

Yanis Tidahy
Fondateur, Aura Flow AI`;

describe("lien de démonstration", () => {
  it("devient une vraie ancre en HTML", () => {
    const html = toHtml(AVEC_LIEN, DEMO);
    expect(html).toContain(`<a href="${DEMO.url}">Diagnostic offert</a>`);
    // Ni bouton, ni style, ni paramètre de suivi : un lien maquillé se voit, et
    // un `?utm_` contredit la « démonstration privée » que la phrase annonce.
    expect(html).not.toContain("style=");
    expect(html).not.toContain("utm_");
    expect(html).not.toContain("<button");
  });

  it("montre l'adresse en texte brut, puisqu'un client texte ne sait pas la rendre", () => {
    const plain = toPlainText(AVEC_LIEN, DEMO);
    expect(plain).toContain(`Diagnostic offert : ${DEMO.url}`);
  });

  it("garde la flèche et la structure du paragraphe dans les deux versions", () => {
    expect(toPlainText(AVEC_LIEN, DEMO)).toContain("→ Diagnostic offert :");
    expect(toHtml(AVEC_LIEN, DEMO)).toContain("→ <a href=");
  });

  it("ne pose qu'une seule ancre, même si le libellé revient", () => {
    // Transformer chaque mention en lien produirait un message truffé d'ancres.
    const deux = "Un Diagnostic offert ici.\n\nEt un Diagnostic offert là.";
    expect(toHtml(deux, DEMO).match(/<a /g)).toHaveLength(1);
  });

  it("n'ajoute rien quand l'URL est vide", () => {
    const sans = { label: "Diagnostic offert", url: "" };
    expect(toHtml(AVEC_LIEN, sans)).not.toContain("<a ");
    expect(toPlainText(AVEC_LIEN, sans)).not.toContain("https://");
  });

  it("n'ajoute rien quand le libellé est absent du corps", () => {
    const corps = "Bonjour,\n\nUne question.";
    expect(toHtml(corps, DEMO)).not.toContain("<a ");
    expect(toPlainText(corps, DEMO)).not.toContain("https://");
  });

  it("échappe l'URL comme le reste : une adresse est du texte", () => {
    const piege = { label: "Diagnostic offert", url: 'https://x.test/?a="b' };
    expect(toHtml(AVEC_LIEN, piege)).toContain('href="https://x.test/?a=&quot;b"');
  });

  it("les deux parties gardent le même nombre de paragraphes", () => {
    const plain = toPlainText(AVEC_LIEN, DEMO).split("\n\n").filter((b) => b.trim() !== "");
    const html = toHtml(AVEC_LIEN, DEMO).match(/<p>/g) ?? [];
    expect(html.length).toBe(plain.length);
  });
});
