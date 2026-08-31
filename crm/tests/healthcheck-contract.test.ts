import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { middleware } from "@/middleware";
import { isPublicPath } from "@/lib/auth/config";

/**
 * **Le contrat du healthcheck de déploiement.**
 *
 * Trois déploiements refusés et deux jours d'incertitude sur ce qui était en
 * ligne, pour une raison qui ne produisait ni erreur, ni test rouge : la cible
 * du healthcheck, `/`, **traverse le verrou**. Sans cookie, elle rend une
 * redirection ; sans `WORKSPACE_PASSWORD`, un 503. Un binaire parfaitement sain
 * peut donc être refusé, et l'ancien continue de servir sans que rien ne dise
 * pourquoi — c'est exactement l'ambiguïté « déployé ou pas » qu'on vient de
 * payer trois fois.
 *
 * Le chemin est lu dans `railway.json` **à l'exécution**, jamais recopié : une
 * constante recopiée cesserait de décrire la configuration réelle au premier
 * changement, et le test resterait vert en ne prouvant plus rien. C'est la même
 * discipline que `backup-columns` (le schéma Prisma) et `auth-routes` (les
 * routes sur le disque).
 */

const ROOT = process.cwd();
const REPO_ROOT = path.join(ROOT, "..");
const PASSWORD = "mot-de-passe-de-test-suffisamment-long";

/**
 * Les noms de fichier que Railway lit comme configuration de déploiement, à la
 * racine du **Root Directory** du service. Le nôtre vaut `crm`, donc le fichier
 * qui gouverne est `crm/railway.json` — et lui seul.
 */
const RAILWAY_CONFIG_NAMES = ["railway.json", "railway.toml"] as const;

/** Le chemin réellement configuré, lu dans le fichier que Railway lit. */
function healthcheckPath(): string {
  const raw = readFileSync(path.join(ROOT, "railway.json"), "utf8");
  const parsed: unknown = JSON.parse(raw);

  const deploy =
    typeof parsed === "object" && parsed !== null && "deploy" in parsed
      ? (parsed as { deploy: unknown }).deploy
      : null;
  const value =
    typeof deploy === "object" && deploy !== null && "healthcheckPath" in deploy
      ? (deploy as { healthcheckPath: unknown }).healthcheckPath
      : null;

  if (typeof value !== "string" || value === "") {
    throw new Error("railway.json ne déclare aucun healthcheckPath exploitable");
  }
  return value;
}

/** Le fichier de route qui sert ce chemin. */
function routeFile(pathname: string): string {
  const segments = pathname.split("/").filter((segment) => segment !== "");
  return path.join(ROOT, "app", ...segments, "route.ts");
}

/** Le code seul : blocs `/* … *\/` et lignes `//` retirés. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

async function through(pathname: string): Promise<Response> {
  return middleware(new NextRequest(new URL(`https://crm.test${pathname}`)));
}

describe("le healthcheck de déploiement répond sans rien demander à personne", () => {
  const previous = process.env.WORKSPACE_PASSWORD;
  beforeEach(() => {
    process.env.WORKSPACE_PASSWORD = PASSWORD;
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.WORKSPACE_PASSWORD;
    else process.env.WORKSPACE_PASSWORD = previous;
  });

  it("le chemin configuré est public", () => {
    // La cause de l'incident, en une assertion : une cible non publique reçoit
    // une redirection ou un 401, que Railway lit comme un échec.
    const target = healthcheckPath();
    expect(
      isPublicPath(target),
      `railway.json vise « ${target} », qui n'est pas dans PUBLIC_PATHS : le healthcheck traverserait le verrou.`,
    ).toBe(true);
  });

  it("le vrai middleware le laisse passer, avec mot de passe configuré", async () => {
    const response = await through(healthcheckPath());
    // `NextResponse.next()` porte 200 et l'en-tête interne de continuation ;
    // une redirection porterait 307, un refus 401 ou 503.
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("il passe **aussi** quand `WORKSPACE_PASSWORD` est absente", async () => {
    // Un déploiement dont une variable manque doit se signaler *dans*
    // l'application, pas en refusant d'être mis en ligne. Sur une cible non
    // publique, cette absence rend 503 et l'ancien binaire reste en service.
    delete process.env.WORKSPACE_PASSWORD;
    const response = await through(healthcheckPath());
    expect(response.status).toBe(200);
  });

  it("sa route ne touche ni la base, ni les réglages, ni l'environnement", () => {
    // **Les commentaires sont retirés avant l'examen.** Sans cela la garde
    // attrape sa propre documentation — le fichier explique justement pourquoi
    // il ne touche pas Prisma — et elle deviendrait un test qu'on contourne en
    // reformulant une phrase plutôt qu'en corrigeant du code.
    const source = stripComments(readFileSync(routeFile(healthcheckPath()), "utf8"));

    const interdits: ReadonlyArray<{ readonly motif: RegExp; readonly quoi: string }> = [
      { motif: /from\s+"@\/lib\//, quoi: "un import de lib/ — un module de la chaîne peut lire un réglage au chargement" },
      { motif: /\bprisma\b/i, quoi: "Prisma — une base momentanément indisponible refuserait le déploiement" },
      { motif: /process\.env/, quoi: "une variable d'environnement — une configuration optionnelle absente bloquerait la mise en ligne" },
    ];

    for (const { motif, quoi } of interdits) {
      expect(motif.test(source), `${routeFile(healthcheckPath())} contient ${quoi}.`).toBe(false);
    }
  });

  it("elle ne divulgue rien de plus que « le processus répond »", async () => {
    // Publique par nécessité, donc muette — même règle que /api/health depuis
    // le jalon 9. Ni commit, ni compteur, ni nom de service.
    const { GET } = await import("@/app/api/live/route");
    const body: unknown = await GET().json();

    expect(body).toEqual({ status: "live", at: expect.any(String) });
  });

  it("un seul fichier peut gouverner le service `crm`", () => {
    // Deux jours perdus à lire la bonne ligne dans le mauvais endroit : le
    // fichier lu ici doit être, démontrablement, celui que Railway lit. Deux
    // fichiers de configuration dans `crm/` en feraient deux sources, dont une
    // seule serait sous test — et c'est la non-testée qui gouvernerait un jour.
    const inCrm = RAILWAY_CONFIG_NAMES.filter((name) =>
      existsSync(path.join(ROOT, name)),
    );

    expect(
      inCrm,
      `crm/ doit porter exactement un fichier de configuration Railway ; trouvés : ${inCrm.join(", ") || "aucun"}.`,
    ).toEqual(["railway.json"]);
  });

  it("aucun fichier de la racine du dépôt ne peut prétendre gouverner le healthcheck", () => {
    // Le Root Directory du service vaut `crm` : un fichier posé à la racine du
    // dépôt appartient à un **autre** service. Il ne changerait donc rien à
    // notre déploiement — mais il porterait un second `healthcheckPath`, et
    // c'est très exactement l'ambiguïté qui a coûté ce jalon : on relit la
    // valeur d'un fichier qui ne gouverne pas celui qu'on déploie.
    const atRepoRoot = RAILWAY_CONFIG_NAMES.filter((name) =>
      existsSync(path.join(REPO_ROOT, name)),
    );

    expect(
      atRepoRoot,
      `${atRepoRoot.join(", ")} existe à la racine du dépôt : deux fichiers déclareraient un healthcheckPath, et seul crm/railway.json gouverne le service crm (Root Directory « crm »).`,
    ).toEqual([]);
  });

  it("`/api/health` n'est **pas** la cible, et c'est délibéré", () => {
    // Elle rend 503 quand la base ne répond pas — c'est tout son intérêt comme
    // diagnostic, et exactement ce qui la disqualifie comme porte de
    // déploiement : le conteneur vient d'exécuter `prisma migrate deploy`.
    expect(healthcheckPath()).not.toBe("/api/health");
  });
});
