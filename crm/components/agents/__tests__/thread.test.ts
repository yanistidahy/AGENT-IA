import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { Thread } from "../thread";
import type { ThreadItem } from "../types";
import type { AgentProfile } from "@/lib/api/agents";

/**
 * Le fil doit ressembler à une conversation avec quelqu'un.
 *
 * Deux règles se vérifient au rendu et nulle part ailleurs : le portrait
 * accompagne la réponse, et **deux réponses consécutives ne le répètent pas** —
 * sinon une réponse longue est hachée en tranches par une colonne d'avatars.
 */

const SARAH: AgentProfile = {
  slug: "sarah",
  name: "Sarah Lemoine",
  role: "Relance & Closing",
  initials: "SL",
  color: "#E8503F",
  scope: "La discipline de relance.",
  starters: [
    { question: "Qui ai-je oublié ?", subtitle: "Les contacts sans nouvelles" },
    { question: "Qu'est-ce que je fais aujourd'hui ?", subtitle: "Vos relances dues" },
    { question: "Quels prospects abandonner ?", subtitle: "Ceux qui ne répondent plus" },
    { question: "Prépare mon prochain appel", subtitle: "L'historique avant de composer" },
  ],
  enabled: true,
  order: 4,
  cadence: "daily",
  locked: false,
  readOnly: false,
  hasPhoto: true,
  photoVersion: "abc123",
};

const NO_PHOTO: AgentProfile = { ...SARAH, slug: "brutus", name: "Brutus", initials: "B", hasPhoto: false, photoVersion: "" };

function agentTurn(text: string): ThreadItem {
  return { kind: "agent", text, thinking: "", chips: [], action: null, actionState: null };
}

/**
 * Rendu, entités HTML décodées.
 *
 * React échappe apostrophes et esperluettes : sans ce décodage, une assertion
 * sur « L'historique… » échouerait sur la mise en forme, pas sur le contenu.
 */
function render(items: readonly ThreadItem[], agent: AgentProfile = SARAH): string {
  return decode(
    renderToStaticMarkup(
      createElement(Thread, {
      items,
      agent,
      streaming: false,
      error: null,
        onDecide: () => undefined,
        onAsk: () => undefined,
      }),
    ),
  );
}

function decode(html: string): string {
  return html
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("<!-- -->", "");
}

/** Compte les portraits réellement rendus — image ou repli initiales. */
function portraitCount(html: string): number {
  return (html.match(/size=thumb/g) ?? []).length + (html.match(/role="img"/g) ?? []).length;
}

describe("écran d'ouverture", () => {
  it("présente l'agent et ses quatre amorces quand le fil est vide", () => {
    const html = render([]);
    expect(html).toContain("à votre service");
    expect(html).toContain("Sarah Lemoine");
    for (const starter of SARAH.starters) {
      expect(html).toContain(starter.subtitle);
    }
  });

  it("cède la place au fil dès le premier message", () => {
    const html = render([{ kind: "user", text: "Qui ai-je oublié ?" }]);
    expect(html).not.toContain("à votre service");
    expect(html).toContain("Qui ai-je oublié ?");
  });
});

describe("portraits dans le fil", () => {
  it("précède une réponse d'agent de son portrait", () => {
    expect(portraitCount(render([{ kind: "user", text: "bonjour" }, agentTurn("Voici.")]))).toBe(1);
  });

  it("ne répète pas le portrait sur deux réponses consécutives", () => {
    const html = render([
      { kind: "user", text: "bonjour" },
      agentTurn("Premier morceau."),
      agentTurn("Deuxième morceau."),
      agentTurn("Troisième morceau."),
    ]);
    // Trois tours d'agent qui se suivent : un seul portrait.
    expect(portraitCount(html)).toBe(1);
  });

  it("le réaffiche quand l'utilisateur reprend la parole entre deux réponses", () => {
    const html = render([
      { kind: "user", text: "bonjour" },
      agentTurn("Voici."),
      { kind: "user", text: "et ensuite ?" },
      agentTurn("La suite."),
    ]);
    expect(portraitCount(html)).toBe(2);
  });

  it("n'attache aucun portrait aux messages de l'utilisateur", () => {
    const html = render([{ kind: "user", text: "bonjour" }]);
    expect(portraitCount(html)).toBe(0);
  });

  it("retombe sur les initiales pour un agent sans photo, sans rien casser", () => {
    const html = render([{ kind: "user", text: "bonjour" }, agentTurn("Voici.")], NO_PHOTO);
    expect(html).toContain('role="img"');
    expect(html).toContain("Portrait de Brutus");
    expect(html).not.toContain("size=thumb");
    expect(portraitCount(html)).toBe(1);
  });
});
