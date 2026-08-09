import { readdir } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { middleware } from "@/middleware";
import { PUBLIC_PATHS, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth/config";
import { issueToken } from "@/lib/auth/session";
import { healthPayload } from "@/lib/health-payload";

/**
 * Le verrou est vérifié contre **la liste réelle des routes**, lue sur le disque
 * à chaque exécution, et non contre une liste recopiée dans le test.
 *
 * C'est la seule forme qui tient dans le temps : une route ajoutée demain entre
 * automatiquement dans le test, et si elle échappe au verrou, le test échoue le
 * jour où elle est écrite — pas le jour où quelqu'un s'en aperçoit en
 * production. C'est exactement le mode de défaillance qu'on répare ici.
 */

const ROOT = process.cwd();
const PASSWORD = "mot-de-passe-de-test-suffisamment-long";

/** Chemins d'API déduits de l'arborescence `app/api/**\/route.ts`. */
async function apiRoutes(dir = path.join(ROOT, "app", "api")): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const routes: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      routes.push(...(await apiRoutes(full)));
    } else if (entry.name === "route.ts") {
      const relative = path.relative(path.join(ROOT, "app"), dir);
      // Les segments dynamiques `[id]` reçoivent une valeur quelconque : le
      // middleware ne les interprète pas, il ne voit qu'un chemin.
      routes.push(`/${relative.split(path.sep).join("/")}`.replace(/\[[^\]]+\]/g, "x"));
    }
  }
  return routes;
}

/** Pages déduites de `app/**\/page.tsx`, groupes `(crm)` retirés du chemin. */
async function pageRoutes(dir = path.join(ROOT, "app")): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const routes: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "api") continue;
      routes.push(...(await pageRoutes(full)));
    } else if (entry.name === "page.tsx") {
      const relative = path.relative(path.join(ROOT, "app"), dir);
      const segments = relative
        .split(path.sep)
        .filter((segment) => segment !== "" && !segment.startsWith("("));
      routes.push(`/${segments.join("/")}`.replace(/\/$/, "") || "/");
    }
  }
  return routes;
}

function request(pathname: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie !== undefined) headers.set("cookie", `${SESSION_COOKIE}=${cookie}`);
  return new NextRequest(new Request(`https://crm.test${pathname}`, { headers }));
}

beforeEach(() => {
  process.env.WORKSPACE_PASSWORD = PASSWORD;
});

describe("aucune route n'est lisible sans session", () => {
  it("toutes les routes d'API répondent 401, sauf les publiques", async () => {
    const routes = await apiRoutes();
    expect(routes.length).toBeGreaterThan(20);

    const leaks: string[] = [];
    for (const route of routes) {
      if (PUBLIC_PATHS.includes(route)) continue;
      const response = await middleware(request(route));
      if (response.status !== 401) leaks.push(`${route} → ${response.status}`);
    }

    expect(leaks, "ces routes d'API répondent sans session").toEqual([]);
  });

  it("toutes les pages redirigent vers /login, sauf les publiques", async () => {
    const routes = await pageRoutes();
    expect(routes).toContain("/");
    expect(routes).toContain("/contacts");

    const leaks: string[] = [];
    for (const route of routes) {
      if (PUBLIC_PATHS.includes(route)) continue;
      const response = await middleware(request(route));
      const target = response.headers.get("location") ?? "";
      if (response.status !== 307 || !target.includes("/login")) {
        leaks.push(`${route} → ${response.status} ${target}`);
      }
    }

    expect(leaks, "ces pages s'affichent sans session").toEqual([]);
  });

  /**
   * Nommés un par un, en plus de l'énumération : ce sont les trois surfaces qui
   * sortent des données personnelles en bloc. Un export CSV lisible sans cookie
   * est l'incident exact qu'on répare — il mérite un test qui le dit.
   */
  it("les exports de données en masse sont fermés", async () => {
    for (const route of ["/api/contacts/export", "/api/companies/export", "/api/backup"]) {
      const response = await middleware(request(route));
      expect(response.status, route).toBe(401);
      expect(await response.text(), route).not.toContain("@");
    }
  });

  it("un jeton valide ouvre l'accès", async () => {
    const token = await issueToken(PASSWORD, SESSION_MAX_AGE);
    const response = await middleware(request("/api/contacts/export", token));
    // `NextResponse.next()` laisse passer : ni redirection, ni 401.
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("un jeton signé par un autre mot de passe est refusé", async () => {
    const token = await issueToken("un-autre-mot-de-passe", SESSION_MAX_AGE);
    const response = await middleware(request("/api/contacts", token));
    expect(response.status).toBe(401);
  });

  it("un jeton expiré est refusé", async () => {
    const token = await issueToken(PASSWORD, -60);
    const response = await middleware(request("/api/contacts", token));
    expect(response.status).toBe(401);
  });

  it("un cookie bricolé est refusé", async () => {
    for (const forged of ["v1.9999999999999.", "v1.9999999999999.aaaa", "n'importe quoi"]) {
      const response = await middleware(request("/api/contacts", forged));
      expect(response.status, forged).toBe(401);
    }
  });

  /**
   * Le cas qui a motivé tout le reste : sans mot de passe configuré, on ferme.
   * Une variable d'environnement oubliée doit casser visiblement, jamais rouvrir
   * l'application en silence.
   */
  it("sans WORKSPACE_PASSWORD, tout est fermé", async () => {
    delete process.env.WORKSPACE_PASSWORD;
    const response = await middleware(request("/api/contacts/export"));
    expect(response.status).toBe(503);
  });
});

describe("la sonde publique ne divulgue rien", () => {
  it("ne renvoie ni compteur, ni nom de table, ni information de déploiement", () => {
    const payload = healthPayload(
      {
        ok: true,
        counts: {
          étapes: 6,
          sociétés: 42,
          contacts: 150,
          affaires: 12,
          interactions: 300,
          tâches: 20,
          séquences: 3,
        },
        total: 533,
      },
      new Date("2026-08-08T00:00:00Z"),
    );

    expect(Object.keys(payload).sort()).toEqual(["checkedAt", "database", "status"]);
    expect(Object.keys(payload.database)).toEqual(["reachable"]);
    expect(payload.status).toBe("ok");

    const serialised = JSON.stringify(payload);
    for (const leak of ["150", "contacts", "sociétés", "total", "commit", "branch"]) {
      expect(serialised, `« ${leak} » ne doit pas sortir`).not.toContain(leak);
    }
  });

  it("distingue toujours une base vide d'une base injoignable", () => {
    const empty = healthPayload({ ok: true, counts: EMPTY_COUNTS, total: 0 }, new Date());
    expect(empty.status).toBe("empty");

    const down = healthPayload(
      { ok: false, diagnosis: { reason: "base injoignable", hint: "hote-interne-secret" } },
      new Date(),
    );
    expect(down.status).toBe("unreachable");
    // Le diagnostic reste interne : son indice nomme l'hôte de la base.
    expect(JSON.stringify(down)).not.toContain("hote-interne-secret");
  });
});

const EMPTY_COUNTS = {
  étapes: 0,
  sociétés: 0,
  contacts: 0,
  affaires: 0,
  interactions: 0,
  tâches: 0,
  séquences: 0,
} as const;
