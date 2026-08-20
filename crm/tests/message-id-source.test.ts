import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * **L'identifiant stocké est celui que nous avons écrit dans le MIME.**
 *
 * Le défaut du jalon 44, en une ligne : `sendMail()` rendait
 * `info.messageId ?? id`. En envoi `raw`, nodemailer ne relit pas les en-têtes
 * du tampon — son `MimeNode` n'a pas de `Message-ID`, donc il en **fabrique**
 * un (`mime-node/index.js:952`) et le rend dans `info.messageId`. Cet
 * identifiant n'a jamais été écrit dans le message : le MIME était déjà
 * composé. La base portait donc un identifiant fantôme pendant que le vrai
 * partait sur le fil, et le rapprochement des réponses comparait des chaînes
 * qui n'avaient jamais existé nulle part.
 *
 * Le coût réel : trois jalons de détection de réponses inopérante, et un
 * diagnostic qui accusait la boîte IMAP.
 *
 * Cette garde est statique parce que le défaut l'est : il ne se voit ni au
 * typecheck — les deux valeurs sont des `string` — ni à l'exécution locale sans
 * serveur SMTP. C'est la même famille que `cost-single-source` et
 * `status-single-source` : une règle qu'on ne peut vérifier qu'en production
 * n'est pas vérifiée.
 */
const SOURCE = readFileSync(join(__dirname, "..", "lib/api/mail.ts"), "utf8");

describe("le Message-ID stocké est le nôtre", () => {
  it("`sendMail` rend l'identifiant qu'il a composé", () => {
    expect(SOURCE).toMatch(/messageId:\s*id,/);
  });

  it("**n'utilise jamais** celui que nodemailer fabrique", () => {
    const offending = SOURCE.split("\n")
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      // Les commentaires en parlent — c'est même là qu'est expliquée la cause.
      // La garde porte sur le code exécuté, pas sur ce qui le documente.
      .filter(
        (entry) =>
          /info\.messageId/.test(entry.line) &&
          !entry.line.startsWith("*") &&
          !entry.line.startsWith("//"),
      );

    expect(
      offending,
      "En envoi `raw`, `info.messageId` est un identifiant inventé par nodemailer " +
        "qui n'apparaît dans aucun message. Le stocker casse le rapprochement des " +
        "réponses, en silence. Utilisez `id`, celui écrit dans le MIME.",
    ).toEqual([]);
  });

  it("l'identifiant écrit dans le MIME et celui rendu sont la même variable", () => {
    // Sans cette troisième assertion, poser `messageId: id` tout en composant le
    // MIME avec une autre valeur passerait les deux premières.
    expect(SOURCE).toMatch(/messageId:\s*id,[\s\S]{0,400}?date:\s*sentAt/);
  });
});
