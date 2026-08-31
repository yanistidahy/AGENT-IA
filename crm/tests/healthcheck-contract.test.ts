import { readFileSync } from "node:fs";
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
const PASSWORD = "mot-de-passe-de-test-suffisamment-long";

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

  it("`/api/health` n'est **pas** la cible, et c'est délibéré", () => {
    // Elle rend 503 quand la base ne répond pas — c'est tout son intérêt comme
    // diagnostic, et exactement ce qui la disqualifie comme porte de
    // déploiement : le conteneur vient d'exécuter `prisma migrate deploy`.
    expect(healthcheckPath()).not.toBe("/api/health");
  });
});
