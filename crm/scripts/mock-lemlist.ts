import { createServer } from "node:http";
import { appendFileSync } from "node:fs";
import { ALL_PAYLOADS } from "../lib/api/__tests__/lemlist-payloads";

/**
 * **Substitut de l'API lemlist, pour les vérifications locales.**
 *
 * Versionné, comme `scripts/mock-anthropic.ts`, et pour la même raison écrite
 * au jalon 17 : un substitut qui vit dans un dossier temporaire et accepte tout
 * fabrique de la confiance. Celui-ci **applique les contraintes documentées** —
 * authentification Basic avec un login vide, `version=v2` obligatoire, page de
 * cent au maximum, `offset` à incrémenter — et refuse ce que la vraie API
 * refuse. Il sert les charges utiles de `lib/api/__tests__/lemlist-payloads.ts`,
 * c'est-à-dire **les mêmes** que les tests unitaires : deux jeux différents
 * finiraient par divergir.
 *
 * ## Ce qu'il permet de vérifier, et qui ne l'était pas autrement
 *
 * - la pagination réelle par `offset`, jusqu'à épuisement ;
 * - le message d'une clé refusée (401) et le fait qu'il **ne cite pas la clé** ;
 * - le recul sur un 429 avec `Retry-After` honoré ;
 * - qu'aucune réponse de l'application ne porte la clé.
 *
 * ## Ce qu'il n'établit pas
 *
 * Que lemlist envoie bien ces champs-là, dans cet ordre-là, aujourd'hui. Il
 * reproduit la forme publiée ; seule la production tranche le reste.
 *
 * Usage : `npx tsx scripts/mock-lemlist.ts [port]`
 *
 * Variables :
 * - `MOCK_KEY` : la clé attendue. Toute autre répond 401.
 * - `MOCK_MODE` : `ok` (défaut), `refuse` (401 partout), `throttle` (un 429
 *   avec `Retry-After: 1` au premier appel, puis normal).
 * - `MOCK_DUMP` : fichier où consigner une ligne JSON par requête reçue, en-têtes
 *   compris. C'est ce qui permet de lire **ce qui part réellement sur le fil**
 *   plutôt que l'intention du code.
 */

const PORT = Number(process.argv[2] ?? 3401);
const EXPECTED = process.env.MOCK_KEY ?? "";
const MODE = process.env.MOCK_MODE ?? "ok";
const DUMP = process.env.MOCK_DUMP ?? "";

let throttled = false;

/** L'authentification documentée : Basic, login vide, la clé en mot de passe. */
function keyOf(header: string | undefined): string | null {
  if (header === undefined || !header.startsWith("Basic ")) return null;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  if (!decoded.startsWith(":")) return null;
  return decoded.slice(1);
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${PORT}`);

  if (DUMP !== "") {
    appendFileSync(
      DUMP,
      `${JSON.stringify({ path: url.pathname, query: url.search, headers: request.headers })}\n`,
    );
  }

  const send = (status: number, body: unknown, headers: Record<string, string> = {}) => {
    response.writeHead(status, { "content-type": "application/json", ...headers });
    response.end(JSON.stringify(body));
  };

  const presented = keyOf(request.headers.authorization);
  if (presented === null) {
    return send(401, { error: "Unauthorized" });
  }
  if (MODE === "refuse" || (EXPECTED !== "" && presented !== EXPECTED)) {
    // Le corps de la vraie API mentionne parfois le début du jeton : on le
    // reproduit, pour vérifier que l'application ne le recopie pas.
    return send(401, { error: `invalid api key: ${presented.slice(0, 6)}…` });
  }

  if (MODE === "throttle" && !throttled) {
    throttled = true;
    return send(429, { error: "Too Many Requests" }, { "retry-after": "1" });
  }

  // `version=v2` est obligatoire : la documentation le dit, et la v1 ne rend
  // pas la même forme.
  if (url.searchParams.get("version") !== "v2") {
    return send(400, { error: "Bad params: version=v2 is mandatory" });
  }

  if (url.pathname === "/api/team") {
    return send(200, { _id: "tea_mock", name: "AuraFLOW (substitut)" });
  }

  if (url.pathname === "/api/activities") {
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 100);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const minDate = url.searchParams.get("minDate");

    let rows = [...ALL_PAYLOADS];
    if (minDate !== null) {
      const floor = new Date(minDate).getTime();
      rows = rows.filter((row) => new Date(String(row["createdAt"])).getTime() >= floor);
    }
    return send(200, rows.slice(offset, offset + limit));
  }

  return send(404, { error: "Not Found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock-lemlist] ${MODE} sur http://127.0.0.1:${PORT}/api`);
});
