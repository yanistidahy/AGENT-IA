import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_VIDEO_DISPLAY } from "../lib/domain/video-display";

/**
 * **La vidéo ne devient du balisage qu'à un seul endroit.**
 *
 * Trois façons de défaire le jalon 99 sans qu'aucun test ne rougisse, parce que
 * les trois produisent du code qui compile et un message qui part :
 *
 * 1. **un second rendu** — une vignette composée dans l'aperçu, dans un écran ou
 *    dans un second assemblage d'envoi. L'aperçu, l'envoi manuel, l'envoi
 *    automatique et la resynchronisation à l'enregistrement montreraient alors
 *    des choses différentes, et c'est toujours le second rendu qu'on oublie de
 *    corriger (jalons 55, 64, 66, 74, 85) ;
 * 2. **un mode deviné** plutôt que lu : une constante, un `"thumbnail"` écrit en
 *    dur dans un appel, un défaut de fonction qui ne serait pas celui de la
 *    colonne. La production rendrait alors autre chose que ce que l'écran règle ;
 * 3. **un défaut qui redevient la vignette**, ce qui rendrait la prospection de
 *    nouveau semblable à une lettre d'information sans que personne l'ait
 *    demandé.
 *
 * Statique, dans la famille de `video-link-source`, `cost-single-source` et
 * `status-single-source` : aucun des trois ne lève, aucun ne viole un type.
 */

function sourceOf(file: string): string {
  return readFileSync(join(process.cwd(), file), "utf8");
}

/** Le code sans ses commentaires : une garde ne doit pas attraper sa propre prose. */
function codeOf(file: string): string {
  return sourceOf(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(process.cwd(), dir))) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(process.cwd(), rel)).isDirectory()) {
      out.push(...walk(rel));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(rel);
  }
  return out;
}

const RENDERERS = "lib/domain/email-format.ts";

describe("la vidéo ne devient du balisage qu'à un seul endroit", () => {
  it("`videoHtml` est le seul à composer une balise de vignette", () => {
    /*
      Ce qu'on cherche : une seconde `<img>` pointant la route de la vignette, ou
      une seconde ancre autour d'elle. La route qui **sert** l'image n'est pas
      concernée : elle rend des octets, pas du balisage de message. Le panneau de
      réglages non plus, dont l'aperçu est un `<img>` relatif dans un écran, pas
      dans un mail (défaut du jalon 62).
    */
    const allowed = new Set([RENDERERS, "components/settings/video-panel.tsx"]);
    const offenders = [...walk("lib"), ...walk("components"), ...walk("app")].filter((file) => {
      if (allowed.has(file)) return false;
      const code = codeOf(file);
      return /<img[^>]*\$\{[^}]*poster/i.test(code) || /posterUrl\)}"/.test(code);
    });
    expect(offenders, "un second rendu de vignette").toEqual([]);
  });

  it("le mode est lu, jamais écrit en dur dans un appel de rendu", () => {
    const offenders = [...walk("lib"), ...walk("components"), ...walk("app")].filter((file) => {
      const code = codeOf(file);
      const at = code.indexOf("videoHtml(");
      if (at === -1) return false;
      // La portée est l'appel, pas le fichier : `videoHtml` prend son dernier
      // argument dans les quelques lignes qui suivent son nom.
      const call = code.slice(at, at + 400);
      return /"(?:link|thumbnail)"/.test(call);
    });
    expect(offenders, "le mode doit venir du réglage, pas d'un littéral").toEqual([]);
  });

  it("l'envoi lit le mode de la configuration, une seule fois", () => {
    const mail = codeOf("lib/api/mail.ts");
    expect(mail).toMatch(/videoHtml\(\s*withSignatureLogo\(/);
    expect(mail).toContain("config.videoDisplay");
    expect((mail.match(/videoHtml\(/g) ?? []).length, "un seul assemblage").toBe(1);
  });

  it("le défaut est le lien texte, à la colonne comme à la fonction", () => {
    expect(DEFAULT_VIDEO_DISPLAY).toBe("link");
    // Le défaut de la colonne est ce que lisent une installation neuve **et** la
    // ligne de réglages déjà en base : sans lui, il faudrait cliquer pour que la
    // prospection cesse de ressembler à une lettre d'information.
    expect(sourceOf("prisma/schema.prisma")).toMatch(
      /videoDisplay\s+String\s+@default\("link"\)/,
    );
    // Le repli de la frontière string → union est le même : une valeur inconnue
    // ne ressuscite pas la vignette.
    expect(codeOf("lib/domain/video-display.ts")).toMatch(
      /raw === "thumbnail" \? "thumbnail" : DEFAULT_VIDEO_DISPLAY/,
    );
  });

  it("la colonne est sauvegardée : une restauration ne ramène pas la vignette", () => {
    // La garde `backup-columns` le vérifie à l'exécution ; ici on fige la raison,
    // qui est que le réglage est une saisie et non une valeur dérivée.
    expect(codeOf("lib/api/backup.ts")).toMatch(/videoDisplay: optionalText/);
  });

  it("changer le mode réécrit la file sans y créer de départ", () => {
    /*
      `{video}` substitue le **libellé**, donc le mode seul ne change pas le texte
      stocké. Mais le libellé se règle dans le même panneau, et lui change bien le
      corps rendu : la file doit suivre l'enregistrement (jalon 97). Ce qu'elle ne
      doit pas faire, c'est composer : enregistrer un réglage n'écrit pas un
      premier message à quelqu'un qui se trouve seulement être dû ce matin.
    */
    const panel = codeOf("lib/api/video-panel.ts");
    expect(panel).toContain("resyncAllManualDepartures");
    expect(panel).not.toContain("composeDepartures");

    const resync = codeOf("lib/api/manual-resync.ts");
    const global = resync.slice(resync.indexOf("export async function resyncAllManualDepartures"));
    expect(global).not.toContain("composeDepartures");
    // Une retouche à la main est conservée et comptée, comme à l'enregistrement
    // d'une séquence : c'est `editedAt` qui tranche, jamais une ressemblance.
    expect(global).toContain("kept");
  });

  it("l'aperçu lit le même mode que l'envoi", () => {
    // Sans cette valeur, rien à l'écran ne dirait lequel des deux assemblages
    // partira, et l'aperçu montrerait le libellé dans les deux cas sans le dire.
    expect(codeOf("lib/api/manual-step.ts")).toContain("readVideoDisplay()");
    expect(codeOf("components/settings/manual-step-editor.tsx")).toContain(
      "samples.videoDisplay",
    );
  });
});
