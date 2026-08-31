import { describe, expect, it } from "vitest";

import { describeUptime, readDeployInfo } from "../deploy-info";

/**
 * **Ce module existe pour lever une ambiguïté, pas pour décorer un pied de page.**
 *
 * Entre « la fusion n'est pas déployée » et « la fusion est déployée et quelque
 * chose ne s'affiche pas », l'écran est identique. Ces tests fixent les deux
 * faits qui les séparent : le commit, et depuis quand il sert les requêtes.
 */
describe("l'identité du déploiement", () => {
  it("rend le commit court **et** entier", () => {
    // Le court se compare d'un coup d'œil, l'entier se colle sans ambiguïté.
    const sha = "54324b6aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    process.env.RAILWAY_GIT_COMMIT_SHA = sha;
    const info = readDeployInfo();
    expect(info.commit).toBe("54324b6");
    expect(info.commitFull).toBe(sha);
  });

  it("une variable absente rend `null`, jamais une chaîne vide", () => {
    // « — » à l'écran veut dire « Railway ne l'a pas injectée », ce qui est une
    // information ; une chaîne vide se lirait comme une valeur.
    delete process.env.RAILWAY_GIT_COMMIT_SHA;
    delete process.env.RAILWAY_GIT_BRANCH;
    process.env.RAILWAY_SERVICE_NAME = "   ";
    const info = readDeployInfo();
    expect(info.commit).toBeNull();
    expect(info.commitFull).toBeNull();
    expect(info.branch).toBeNull();
    expect(info.service).toBeNull();
  });

  it("l'instant de démarrage est stable d'un appel à l'autre", () => {
    // Recalculé à chaque requête, il varierait de quelques millisecondes et
    // ferait douter d'un affichage qu'on consulte précisément pour trancher.
    expect(readDeployInfo().startedAt.getTime()).toBe(readDeployInfo().startedAt.getTime());
  });

  it("l'instant de démarrage est dans le passé, jamais dans le futur", () => {
    expect(readDeployInfo().startedAt.getTime()).toBeLessThanOrEqual(Date.now());
  });
});

describe("l'âge du déploiement se lit sans soustraction mentale", () => {
  const at = (minutes: number) => {
    const now = new Date("2026-08-31T12:00:00Z");
    return describeUptime(new Date(now.getTime() - minutes * 60000), now);
  };

  it("donne l'échelle utile à chaque durée", () => {
    expect(at(0)).toBe("à l'instant");
    expect(at(5)).toBe("il y a 5 min");
    expect(at(59)).toBe("il y a 59 min");
    expect(at(60)).toBe("il y a 1 h");
    expect(at(16 * 60)).toBe("il y a 16 h");
    expect(at(72 * 60)).toBe("il y a 3 j");
  });

  it("le cas qui nous a coûté deux allers-retours se lit d'un coup", () => {
    // Une fusion faite il y a dix minutes, un processus démarré il y a seize
    // heures : le déploiement est en retard, et la phrase le dit sans calcul.
    expect(at(16 * 60)).toContain("16 h");
  });
});
