import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **La vidéo est hébergée, et la vignette est la nôtre.**
 *
 * Quatre façons de défaire ce jalon sans qu'aucun test ne rougisse, parce que
 * les quatre produisent du code qui compile et un message qui part :
 *
 * 1. **une pièce jointe**, ajoutée « pour que la vidéo arrive quoi qu'il
 *    arrive ». C'est l'un des signaux de spam les plus forts qui soient, et
 *    IONOS refuserait le message pour sa taille — mais le code, lui, ne dirait
 *    rien ;
 * 2. **une vignette servie par l'hébergeur** plutôt que par nous : une image
 *    chargée depuis un tiers est un signal de démarchage en masse, et elle
 *    confie à ce tiers la liste des gens qui ouvrent nos messages (jalon 62) ;
 * 3. **un compteur** sur la route qui sert la vignette ou le fichier. Ce serait
 *    un suivi d'ouverture, puis un suivi de clic, par une porte qu'on n'a pas
 *    déclarée — exactement ce que la demande écarte en refusant qu'un traceur
 *    externe voyage avec l'image ;
 * 4. **un second rendu**, dans l'aperçu ou dans un écran, qui finirait par ne
 *    plus dire la même chose que l'envoi. Ce projet l'a payé aux jalons 55, 64,
 *    66, 74 et 85.
 *
 * Statique, comme `cost-single-source`, `research-single-source` et
 * `manual-step-source` : aucun de ces quatre défauts ne lève, aucun ne viole un
 * type, et le message paraît normal à la relecture.
 */

function sourceOf(file: string): string {
  return readFileSync(join(process.cwd(), file), "utf8");
}

/** Le source privé de ses commentaires — sinon la garde attrape sa propre documentation. */
function codeOf(file: string): string {
  return sourceOf(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(process.cwd(), dir))) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(process.cwd(), rel)).isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__") continue;
      out.push(...walk(rel));
      continue;
    }
    if (/\.tsx?$/.test(entry)) out.push(rel);
  }
  return out;
}

describe("la vidéo n'est jamais attachée", () => {
  it("aucun chemin d'envoi ne compose de pièce jointe pour elle", () => {
    /*
      `attachments` est la clé de nodemailer. Elle n'apparaît nulle part dans le
      produit aujourd'hui, et c'est ce que ce test fige : la seule façon de
      « joindre » une vidéo est d'ajouter cette clé, et elle se verrait ici avant
      de se voir dans une boîte de quarantaine.
    */
    for (const file of ["lib/api/mail.ts", "lib/api/email-send.ts", "lib/api/mail-video.ts"]) {
      expect(codeOf(file), file).not.toMatch(/\battachments\b/);
    }
  });

  it("le stockage ne sert jamais le fichier vidéo dans un message", () => {
    // `readVideoFile` existe pour la route publique qui le sert à un navigateur,
    // jamais pour le composeur de message.
    expect(codeOf("lib/api/mail.ts")).not.toContain("readVideoFile");
  });
});

describe("la vignette vient de nous", () => {
  it("son adresse est composée depuis notre base publique, jamais depuis l'hébergeur", () => {
    const mail = codeOf("lib/api/mail.ts");
    expect(mail).toMatch(/posterUrl\(base/);
    // La seule chose que l'adresse collée puisse décider est la destination du
    // clic, et elle passe par `videoDestination` — jamais par la vignette.
    expect(mail).toMatch(/videoDestination\(/);
  });

  it("le rendu HTML ne pointe que sur l'adresse de vignette qu'on lui donne", () => {
    const format = codeOf("lib/domain/email-format.ts");
    expect(format).toMatch(/src="\$\{escapeHtmlText\(poster\)\}"/);
  });

  it("aucun paramètre n'est accroché à l'adresse de la vignette", () => {
    // Ni jeton, ni compteur, ni `utm_` : c'est une identité, pas un appel à
    // l'action pisté (jalons 34 et 62).
    const code = codeOf("lib/domain/signature-video.ts") + codeOf("lib/api/mail.ts");
    expect(code).not.toMatch(/utm_/);
  });
});

describe("les routes publiques ne comptent rien", () => {
  const routes = [
    "app/api/video/[version]/route.ts",
    "app/api/video/[version]/fichier/route.ts",
  ];

  it("elles ne font aucune écriture en base", () => {
    for (const route of routes) {
      const code = codeOf(route);
      expect(code, route).not.toMatch(/\.(update|updateMany|create|upsert|increment)\b/);
    }
  });

  it("elles ne lisent ni adresse IP, ni agent utilisateur", () => {
    // La promesse du jalon 37, tenue jusque dans les routes de ce jalon : on
    // stocke un jeton, jamais un profil.
    for (const route of routes) {
      const code = codeOf(route);
      expect(code, route).not.toMatch(/user-agent|x-forwarded-for|\bip\b/i);
    }
  });

  it("une version inconnue rend 404, jamais le fichier courant", () => {
    // Servir autre chose que ce qui est demandé ferait mentir le cache d'un an
    // de tous les messages déjà partis.
    for (const route of routes) {
      expect(codeOf(route), route).toMatch(/version !== version|\.version !== version/);
    }
  });
});

describe("un seul rendu, une seule substitution", () => {
  it("l'ancre et l'image de la vignette ne sont composées qu'à un endroit", () => {
    const offenders = [...walk("lib"), ...walk("components"), ...walk("app")].filter(
      (file) =>
        file !== "lib/domain/email-format.ts" &&
        /<a href=|<img /.test(codeOf(file)) &&
        /posterUrl|api\/video\//.test(codeOf(file)) &&
        // Le panneau de réglages affiche un aperçu par chemin **relatif** : ce
        // n'est pas un rendu de message, c'est l'écran où l'on choisit l'image.
        file !== "components/settings/video-panel.tsx",
    );
    expect(offenders).toEqual([]);
  });

  it("`{video}` n'est substitué que par le rendu de gabarit du jalon 87", () => {
    const offenders = [...walk("lib"), ...walk("components"), ...walk("app")].filter(
      (file) => file !== "lib/domain/merge-tags.ts" && /replaceAll\("\{video\}"/.test(codeOf(file)),
    );
    expect(offenders).toEqual([]);
  });

  it("l'aperçu et l'envoi lisent la même vidéo", () => {
    /*
      `signatureVideo` décide à la fois si la vignette part et quel libellé le
      gabarit reçoit. Une seconde lecture dans l'aperçu annoncerait une phrase
      que l'envoi retirerait — faute d'adresse publique, par exemple — et
      personne ne s'en apercevrait avant la réception.
    */
    expect(codeOf("lib/api/manual-step.ts")).toMatch(/signatureVideo\(\)/);
    expect(codeOf("lib/api/mail.ts")).toMatch(/const video = await signatureVideo\(\)/);
  });

  it("la vignette est posée après le logo et avant le pixel", () => {
    const mail = codeOf("lib/api/mail.ts");
    const html = /withVideoThumbnail\(\s*withSignatureLogo\(/.test(mail);
    expect(html, "la vignette doit envelopper le logo, pas l'inverse").toBe(true);
    // Le pixel reste la toute dernière chose du corps (jalon 43).
    expect(mail).toMatch(/html: withTrackingPixel\(html/);
  });
});
