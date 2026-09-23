import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { followUpRules, STEP_MAX_WORDS } from "../lib/agents/prompts/follow-up";

/**
 * **Une relance doit savoir qu'elle en est une.**
 *
 * Quatre façons de rater ce jalon, et aucune ne lève ni ne casse un type :
 *
 * 1. **le rang de l'étape ne parvient pas au modèle** : Alex écrit alors un
 *    premier message à quelqu'un qui en a déjà reçu un ;
 * 2. **le message précédent est reconstruit au lieu d'être lu** : on croit
 *    savoir ce qu'on a écrit, et on laisse passer les phrases mêmes qu'on
 *    voulait éviter ;
 * 3. **les interdits deviennent des omissions** : ne pas parler du fait des
 *    69 % ne dit pas de ne pas le reprendre. Un « non » se lit comme une règle,
 *    c'est la construction du DM (jalon 48) ;
 * 4. **la garde d'écho est posée mais jamais lue** : elle ne sert alors qu'à
 *    rassurer celui qui l'a écrite.
 */

const ROOT = path.join(__dirname, "..");

function sourceOf(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("Alex sait quelle étape il écrit", () => {
  it("la composition lui passe le rang et le message précédent", () => {
    const departures = sourceOf("lib/api/departures.ts");
    expect(departures).toMatch(/\{ step: verdict\.step, previous \}/);
    // **Lu dans les envois**, jamais reconstruit.
    expect(departures).toMatch(/prisma\.emailSend\.findFirst/);
  });

  it("et la rédaction les injecte dans l'instruction", () => {
    const draft = sourceOf("lib/agents/email-draft.ts");
    expect(draft).toMatch(/followUpRules\(stepContext\.step, stepContext\.previous\)/);
    // Les exemples de forme ne partent qu'à partir de l'étape 2 : à l'étape 1,
    // ils seraient deux fois le même conseil.
    expect(draft).toMatch(/stepContext\.step > 1 \? `[\s\S]{0,60}FOLLOW_UP_EXAMPLES/);
  });

  it("le premier message ne reçoit pas les consignes de relance", () => {
    const step1 = followUpRules(1, null);
    expect(step1).toContain("étape 1");
    expect(step1).not.toContain("69 %");
    expect(step1).not.toContain("dernier message");
  });
});

describe("les interdits sont dits comme des interdits", () => {
  const step2 = followUpRules(2, { sentOn: "15/09/2026", body: "Le message d'avant." });

  it("le fait des 69 %, la description du produit et la phrase de démonstration", () => {
    expect(step2).toMatch(/N'ouvre jamais sur le fait des 69 %/);
    expect(step2).toMatch(/Ne redécris pas le conseiller de vente dans les mêmes termes/);
    expect(step2).toMatch(/Ne reprends pas la phrase de démonstration mot pour mot/);
    expect(step2).toMatch(/N'ouvre pas sur le message précédent, ni sur le temps écoulé/);
  });

  it("le message déjà envoyé est donné en entier, et qualifié", () => {
    expect(step2).toContain("Le message d'avant.");
    expect(step2).toContain("15/09/2026");
    expect(step2).toMatch(/Tu ne réécris ni ses phrases/);
  });

  it("observer leur site est permis, prêter une intention à leurs visiteurs ne l'est pas", () => {
    // La règle demandée : un fait visible se vérifie en un clic, une
    // affirmation sur leur trafic est invérifiable et le prospect le sait.
    expect(step2).toMatch(/Tu observes leur site, tu ne prêtes rien à leurs visiteurs/);
    expect(step2).toMatch(/revient à chaque\s+visite/);
  });

  it("chaque étape a son but et sa longueur, décroissante", () => {
    expect(STEP_MAX_WORDS[1]).toBeGreaterThan(STEP_MAX_WORDS[2] as number);
    expect(STEP_MAX_WORDS[2]).toBeGreaterThan(STEP_MAX_WORDS[3] as number);
    expect(step2).toMatch(/plus court que le message/);
    expect(followUpRules(3, null)).toMatch(/dernier message/);
    expect(followUpRules(3, null)).toMatch(/Aucune question/);
  });
});

describe("la garde d'écho est lue là où on relit", () => {
  it("la file la recalcule à chaque lecture, retouches comprises", () => {
    const departures = sourceOf("lib/api/departures.ts");
    expect(departures).toMatch(/describeEcho\(echoOf\(previous\.body/);
  });

  it("et la carte la montre", () => {
    expect(sourceOf("components/sequences/departures-view.tsx")).toMatch(/departure\.echo !== ""/);
  });
});
