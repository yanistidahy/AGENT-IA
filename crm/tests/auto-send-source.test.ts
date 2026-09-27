import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * **L'envoi automatique passe par la fonction du bouton, ou il ne passe pas.**
 *
 * Statique parce que le défaut l'est : un second chemin d'envoi compile, ne lève
 * pas, et fait partir des messages corrects — jusqu'au jour où il oublie la
 * fiche passée en « Perdu » depuis l'inscription, la campagne mise en pause, ou
 * le plafond de débit. Aucun type ne le voit, aucun test fonctionnel ne le voit
 * tant qu'on n'a pas exactement le cas sous la main.
 *
 * Même famille que `cost-single-source`, `status-single-source` et
 * `departure-send-source`.
 */

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

/** Le corps du code, commentaires retirés : une garde ne s'attrape pas elle-même. */
function code(path: string): string {
  return read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const SERVICE = "lib/api/auto-send.ts";
const LOOP = "lib/api/auto-send-loop.ts";

describe("l'ordonnanceur utilise le chemin d'envoi du bouton", () => {
  it("appelle `sendDeparture`, et rien d'autre", () => {
    const body = code(SERVICE);
    expect(body).toContain('from "./departures"');
    expect(body).toMatch(/sendDeparture\(\s*[^,]+,\s*"scheduler"/);
  });

  it("n'ouvre aucun second chemin d'envoi", () => {
    for (const path of [SERVICE, LOOP]) {
      const body = code(path);
      // `sendEmailToContact` est la couche *sous* `sendDeparture` : l'appeler
      // directement sauterait la règle de séquence, la pause de campagne et le
      // plafond de débit.
      expect(body, `${path} ne doit pas envoyer lui-même`).not.toContain("sendEmailToContact");
      expect(body, `${path} ne doit pas composer de message`).not.toContain("sendMail");
      expect(body).not.toContain("nodemailer");
    }
  });

  it("n'appelle jamais le modèle : un brouillon en file est déjà écrit et déjà payé", () => {
    for (const path of [SERVICE, LOOP]) {
      const body = code(path);
      for (const forbidden of [
        "draftEmail",
        "reviseEmail",
        "researchCompany",
        "messages.create",
        "messages.stream",
        "anthropic",
      ]) {
        expect(body, `${path} ne doit pas contenir ${forbidden}`).not.toContain(forbidden);
      }
    }
  });
});

describe("le verrou est la ligne, pas une vérification", () => {
  it("le créneau est réclamé par un `updateMany` conditionné sur l'échéance", () => {
    const body = code(SERVICE);
    expect(body).toMatch(/updateMany\(\{[\s\S]*dueAt: \{ lte: now \}/);
    // Ce qui rend le verrou vrai : l'appelant lit le nombre de lignes touchées
    // plutôt que de supposer avoir gagné.
    expect(body).toContain("claimed.count === 1");
  });

  it("l'échéance vit en base, donc un redémarrage reprend où il en était", () => {
    // Aucune échéance en mémoire dans la boucle : elle ne fait que battre.
    const loop = code(LOOP);
    expect(loop).not.toContain("dueAt");
    expect(loop).toContain("tick(");
  });
});

describe("la décision d'envoi reste à trois valeurs", () => {
  it("le week-end vaut pour la machine et pour l'ordonnanceur, jamais pour le clic", () => {
    const body = code("lib/api/departures.ts");
    expect(body).toContain('mode === "human" ? "human" : "machine"');
  });

  it("le double verrou par séquence ne vaut que pour la composition", () => {
    const body = code("lib/api/departures.ts");
    expect(body).toMatch(/mode === "compose" && !canSendAutomatically/);
  });

  it("`auto` en base ne compte pas les envois de l'ordonnanceur comme validés à la main", () => {
    expect(code("lib/api/departures.ts")).toContain('const auto = mode !== "human"');
  });
});

describe("le compteur d'échecs coupe, et ne se tait pas", () => {
  it("s'éteint de lui-même au plafond, en écrivant la cause", () => {
    const body = code(SERVICE);
    expect(body).toContain("failures >= MAX_FAILURES");
    expect(body).toMatch(/enabled: false,[\s\S]{0,80}stoppedReason: outcome\.message/);
  });

  it("un refus qui retire le départ de la file ne compte pas comme une panne", () => {
    // Sinon une file saine — fiches closes, réponses arrivées — couperait
    // l'envoi automatique au troisième départ légitimement écarté.
    expect(code(SERVICE)).toContain("stillQueued === 0");
  });
});
