import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { matchRole, roleAngleRule } from "@/lib/domain/role-angles";

/**
 * **Le dossier d'Alex énonce toujours l'angle, le collègue et la fonction.**
 *
 * Trois faits, une même règle — celle que le DM a établie au jalon 48 : une
 * consigne construite depuis la donnée, jamais laissée au jugement, et
 * **présente aussi à la forme négative**. « Adapte-toi au rôle si tu le
 * connais » invite un modèle à supposer qu'il le connaît, puisque la phrase
 * existe ; « aucun rôle réglé ne reconnaît sa fonction » ferme la porte.
 *
 * L'enjeu est le même que pour le DM, à une échelle plus grande : un message
 * qui parle de conversion à une responsable SAV, ou qui resert à la collègue
 * l'accroche déjà lue par la fondatrice, ne se rattrape pas — les deux
 * destinataires se parlent, et c'est précisément pour cela qu'on écrit aux deux.
 *
 * Garde **statique** parce que le défaut le serait : tout est `string`, rien ne
 * lève, aucun test ne rougit. Même famille que `dm-mention-source` et
 * `contact-name-source`.
 */

const ROOT = process.cwd();

/** Le code seul : blocs `/* … *\/` et lignes `//` retirés. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const DRAFT = stripComments(readFileSync(path.join(ROOT, "lib/agents/email-draft.ts"), "utf8"));

describe("l'angle du rôle atteint toujours le modèle", () => {
  it("l'angle est **cherché**, pas déduit du dossier", () => {
    // `angleFor` interroge les rôles réglés. Laisser le modèle déduire l'angle
    // de l'intitulé — « Head of Customer Care, donc parle-lui de tickets » —
    // reviendrait à lui faire inventer la note que l'utilisateur n'a pas écrite.
    expect(
      /angleFor\(/.test(DRAFT),
      "lib/agents/email-draft.ts ne demande plus l'angle du rôle : il serait deviné.",
    ).toBe(true);
  });

  it("la consigne d'angle est posée sans condition dans l'instruction", () => {
    // `context.angleRule` porte **les deux** cas : la note quand elle existe,
    // l'interdiction quand elle n'existe pas. Un `if` ici ferait disparaître la
    // seconde, et l'absence de ligne se lit comme une absence d'information.
    expect(
      /\$\{context\.angleRule\}/.test(DRAFT),
      "L'instruction de rédaction n'inclut plus context.angleRule.",
    ).toBe(true);
  });

  it("le collègue déjà écrit est annoncé, et son accroche interdite", () => {
    expect(/\$\{colleagueRule\(context\.colleague\)\}/.test(DRAFT)).toBe(true);
    expect(
      /N'écris ni cette phrase, ni une reformulation de cette phrase/.test(DRAFT),
      "La consigne ne nomme plus la phrase à ne pas reprendre : « varie un peu » " +
        "produit une reformulation, que le destinataire reconnaît.",
    ).toBe(true);
  });

  it("la note pour Alex ne se confond pas avec les Notes de la fiche", () => {
    // `notes` porte le déversoir de l'import — lignes `SITE :`, `N° :`, titres
    // de page (jalon 24). Les fusionner ferait prendre un titre d'onglet pour
    // un fait sur la marque.
    expect(/contact\.alexNote/.test(DRAFT)).toBe(true);
    expect(
      /écrit à la main/.test(DRAFT),
      "La note pour Alex entre dans le dossier sans être annoncée comme telle.",
    ).toBe(true);
  });

  it("la fonction est annoncée sous ses deux formes", () => {
    expect(/Fonction du destinataire : NON RENSEIGNÉE/.test(DRAFT)).toBe(true);
  });
});

describe("les deux cas de la consigne d'angle, sur pièces", () => {
  const role = {
    id: "r_sav",
    name: "Responsable SAV",
    angle: "Elle mesure son volume de tickets. Parler du SAV absorbé, pas de conversion.",
    labels: ["Head of Customer Care"],
  };

  it("apparié : la note de l'utilisateur, mot pour mot", () => {
    const rule = roleAngleRule(matchRole("Head of Customer Care", [role]));
    expect(rule).toContain("Parler du SAV absorbé, pas de conversion.");
  });

  it("non apparié : une interdiction, pas un silence", () => {
    const rule = roleAngleRule(matchRole("Office Manager", [role]));
    expect(rule).toContain("AUCUN");
    expect(rule).toContain("N'invente pas");
    expect(rule).not.toContain("SAV absorbé");
  });
});
