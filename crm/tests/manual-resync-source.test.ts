import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * **Enregistrer doit resynchroniser les étapes manuelles, et elles seules.**
 *
 * Les deux défauts que cette garde ferme ne lèvent rien, ne cassent aucun type
 * et ne font rougir aucun test :
 *
 * 1. **l'enregistrement cesse de resynchroniser** — la file garde le texte
 *    d'avant, l'écran montre autre chose que ce qui partira, et c'est exactement
 *    le défaut que le jalon 96 a passé sa journée à rendre visible ;
 * 2. **il se met à recomposer les étapes rédigées par Alex** — un appel au
 *    modèle par contact, depuis un geste qui n'en demande aucun, et la facture
 *    n'arrive qu'au compteur du jalon 36, après coup.
 *
 * Même famille que `cost-single-source`, `manual-step-source` et
 * `departure-send-source` : un défaut statique mérite une garde statique.
 */

const ROOT = path.join(__dirname, "..");
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

const sequences = read("lib/api/email-sequences.ts");
const resync = read("lib/api/manual-resync.ts");
const departures = read("lib/api/departures.ts");
const panel = read("components/settings/email-sequences-panel.tsx");
const route = read("app/api/sequences-email/route.ts");

describe("enregistrer une séquence remet sa file à jour", () => {
  it("le chemin d'enregistrement appelle la resynchronisation", () => {
    expect(sequences).toContain("resyncManualDepartures(saved)");
    // Après la fermeture des inscriptions sans étape suivante, jamais avant :
    // recomposer pour quelqu'un que l'enregistrement vient de clore écrirait un
    // brouillon que personne ne recevra.
    const close = sequences.indexOf("closeWithoutNextStep(saved");
    const call = sequences.indexOf("resyncManualDepartures(saved)");
    expect(close).toBeGreaterThan(-1);
    expect(call).toBeGreaterThan(close);
    // Le rapport voyage jusqu'à l'écran : un geste muet est un geste qu'on
    // refait en croyant qu'il n'a rien fait.
    expect(sequences).toContain("resync");
    expect(route).toContain("resync: result.resync");
    expect(panel).toContain("describeResync(");
    expect(panel).toContain("hasResyncNews(");
  });

  it("elle ne réécrit que les étapes manuelles, et ne rédige jamais", () => {
    expect(resync).toMatch(/toStepMode\(step\.mode\) === "manual"/);
    expect(resync).toContain("renderManualStep(");
    // Aucune rédaction, aucune recherche, aucun appel au modèle : ce chemin est
    // une substitution de balises, et c'est ce qui autorise un enregistrement à
    // le déclencher.
    for (const forbidden of [
      "draftEmail",
      "reviseEmail",
      "researchCompany",
      "researchFor",
      "messages.create",
      "messages.stream",
      "anthropic",
    ]) {
      expect(resync).not.toContain(forbidden);
    }
  });

  it("la création passe par la composition, avec la portée manuelle", () => {
    // Décider soi-même qui est dû reviendrait à réécrire `nextStep`, et c'est la
    // fonction qui porte les garde-fous : une seconde version en oublierait un,
    // et ce serait celui de la fiche close ou de l'opposition au démarchage
    // (jalon 56, « une portée, pas une seconde boucle »).
    expect(resync).toMatch(/composeDepartures\(now, \{ sequenceId, manualOnly: true \}\)/);
    expect(resync).not.toContain("nextStep(");
    expect(departures).toContain("manualOnly");
    // La portée **saute** l'étape d'Alex, elle ne l'arrête pas : l'inscription
    // reste due, et « Écrire les mails » l'écrira.
    expect(departures).toMatch(/scope\.manualOnly === true && !isManual[\s\S]{0,120}continue;/);
  });

  it("une retouche à la main est reconnue au geste, pas devinée du texte", () => {
    // `editedAt` est posé par `saveDeparture`. Comparer le texte au gabarit
    // confondrait « corrigé par quelqu'un » avec « composé depuis une autre
    // version », qui est précisément l'autre cas — celui que `stale` décrit.
    expect(resync).toContain("departure.editedAt !== null");
    expect(resync).toMatch(/editedAt !== null[\s\S]{0,120}kept \+= 1/);
    expect(departures).toContain("edited: row.editedAt !== null");
  });

  it("retirer un départ de la file ne touche pas l'inscription", () => {
    const start = departures.indexOf("export async function dropDeparture");
    expect(start).toBeGreaterThan(-1);
    const slice = departures.slice(start, departures.indexOf("\nexport ", start + 1));
    expect(slice).toContain("sequenceDeparture.delete");
    // Ni arrêt d'inscription, ni décalage d'échéance : ce sont les deux voisins
    // (`removeFromSequence`, `postponeDeparture`), et les confondre ferait
    // quitter la campagne à quelqu'un dont on jetait seulement le texte.
    expect(slice).not.toContain("sequenceEnrollment.update");
    expect(slice).not.toContain("lastSentAt");
  });
});
