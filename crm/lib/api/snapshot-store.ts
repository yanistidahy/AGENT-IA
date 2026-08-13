import "server-only";
import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { dateFromKey, type SnapshotMeta } from "../domain/snapshots";

/**
 * Où vivent les instantanés.
 *
 * **Le point qui compte n'est pas le job, c'est la destination.** Le conteneur
 * Railway n'a pas de disque durable, et écrire les instantanés dans le
 * PostgreSQL qu'ils sont censés secourir ne protège de rien : la panne qu'on
 * assure emporterait les deux. Une sauvegarde doit sortir de la plateforme
 * qu'elle sauvegarde.
 *
 * D'où cette interface et ses pilotes, choisis par `SNAPSHOT_STORE` :
 *
 * - `github` — dépôt privé, via l'API Contents. Aucun fournisseur nouveau,
 *   gratuit, consultable dans un navigateur, et hors de Railway. C'est le
 *   défaut recommandé. **Réserve honnête** : git conserve l'historique, donc
 *   une sauvegarde « supprimée » par la rétention reste dans les commits
 *   passés. Pour des données personnelles, la suppression réelle demande de
 *   supprimer le dépôt entier.
 * - `s3` — n'est pas implémenté ici et ne doit pas l'être à l'aveugle : je n'ai
 *   pas de compte pour l'exercer, et un pilote de sauvegarde non testé est pire
 *   qu'une absence de pilote, parce qu'il rassure. Voir CLAUDE.md.
 * - `local` — disque local. **Vérification seulement.** Le conteneur perd son
 *   disque à chaque déploiement ; ce pilote existe pour les tests, pas pour la
 *   production, et le dit à l'écran.
 */

export interface SnapshotStore {
  readonly kind: "github" | "local";
  /** Description affichable de la destination, sans secret. */
  readonly where: string;
  /** Durable au-delà du conteneur ? `false` déclenche un avertissement. */
  readonly durable: boolean;
  list(): Promise<SnapshotMeta[]>;
  put(key: string, contents: string): Promise<void>;
  get(key: string): Promise<string | null>;
  remove(key: string): Promise<void>;
}

/* ------------------------------------------------------------------ GitHub */

interface GitHubConfig {
  readonly repo: string;
  readonly token: string;
  readonly branch: string;
  readonly directory: string;
}

function githubConfig(): GitHubConfig | null {
  const repo = process.env.SNAPSHOT_GITHUB_REPO;
  const token = process.env.SNAPSHOT_GITHUB_TOKEN;
  if (typeof repo !== "string" || repo.trim() === "") return null;
  if (typeof token !== "string" || token.trim() === "") return null;
  return {
    repo: repo.trim(),
    token: token.trim(),
    branch: process.env.SNAPSHOT_GITHUB_BRANCH?.trim() ?? "main",
    directory: process.env.SNAPSHOT_GITHUB_DIR?.trim() ?? "snapshots",
  };
}

/** L'API Contents exige le `sha` du fichier pour l'écraser ou le supprimer. */
async function githubSha(config: GitHubConfig, key: string): Promise<string | null> {
  const response = await githubFetch(config, `${config.directory}/${key}`, { method: "GET" });
  if (response.status === 404) return null;
  if (!response.ok) throw await githubError(response, `en lisant ${key}`);
  const payload: unknown = await response.json();
  if (typeof payload === "object" && payload !== null && "sha" in payload) {
    const sha = (payload as { sha: unknown }).sha;
    return typeof sha === "string" ? sha : null;
  }
  return null;
}

function githubFetch(
  config: GitHubConfig,
  suffix: string,
  init: RequestInit,
  accept = "application/vnd.github+json",
): Promise<Response> {
  return fetch(`https://api.github.com/repos/${config.repo}/contents/${suffix}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: accept,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    cache: "no-store",
  });
}

/**
 * L'erreur GitHub, avec son texte.
 *
 * Le code seul ne suffit pas au moment de la configuration : un 404 sur une
 * écriture veut dire « branche absente », « dépôt inconnu » ou « jeton sans
 * accès à ce dépôt » — trois causes, trois gestes différents. GitHub le dit
 * dans `message`, autant le relayer jusqu'à l'écran de réglages.
 */
async function githubError(response: Response, what: string): Promise<Error> {
  let detail = "";
  try {
    const payload: unknown = await response.json();
    if (typeof payload === "object" && payload !== null && "message" in payload) {
      const message = (payload as { message: unknown }).message;
      if (typeof message === "string") detail = ` — ${message}`;
    }
  } catch {
    // Corps illisible : le code seul devra suffire.
  }
  return new Error(`GitHub ${response.status} ${what}${detail}`);
}

function githubStore(config: GitHubConfig): SnapshotStore {
  return {
    kind: "github",
    where: `dépôt privé ${config.repo} (${config.directory}/)`,
    durable: true,

    async list() {
      const response = await githubFetch(config, `${config.directory}?ref=${config.branch}`, {
        method: "GET",
      });
      // Un dossier encore inexistant n'est pas une erreur : c'est l'état avant
      // la première sauvegarde.
      if (response.status === 404) return [];
      if (!response.ok) throw await githubError(response, "en listant les instantanés");

      const payload: unknown = await response.json();
      if (!Array.isArray(payload)) return [];

      const found: SnapshotMeta[] = [];
      for (const entry of payload as { name?: unknown; size?: unknown }[]) {
        if (typeof entry.name !== "string") continue;
        const takenAt = dateFromKey(entry.name);
        if (takenAt === null) continue;
        found.push({
          key: entry.name,
          takenAt,
          bytes: typeof entry.size === "number" ? entry.size : 0,
        });
      }
      return found;
    },

    async put(key, contents) {
      const sha = await githubSha(config, key);
      const response = await githubFetch(config, `${config.directory}/${key}`, {
        method: "PUT",
        body: JSON.stringify({
          message: `Sauvegarde AuraFLOW ${key}`,
          content: Buffer.from(contents, "utf8").toString("base64"),
          branch: config.branch,
          ...(sha === null ? {} : { sha }),
        }),
      });
      if (!response.ok) throw await githubError(response, `en écrivant ${key}`);
    },

    /**
     * Lit le contenu brut, **pas** l'enveloppe JSON.
     *
     * Au-delà d'un mégaoctet, la réponse JSON de l'API Contents renvoie
     * `content: ""` avec `encoding: "none"` : elle réussit, et elle est vide.
     * Une sauvegarde de CRM dépasse ce seuil très vite, et le défaut serait
     * invisible jusqu'à la restauration — le seul moment où il coûte tout. Le
     * type média `raw` rend le fichier tel quel jusqu'à cent mégaoctets.
     */
    async get(key) {
      const response = await githubFetch(
        config,
        `${config.directory}/${key}?ref=${config.branch}`,
        { method: "GET" },
        "application/vnd.github.raw",
      );
      if (response.status === 404) return null;
      if (!response.ok) throw await githubError(response, `en lisant ${key}`);
      return response.text();
    },

    async remove(key) {
      const sha = await githubSha(config, key);
      if (sha === null) return;
      const response = await githubFetch(config, `${config.directory}/${key}`, {
        method: "DELETE",
        body: JSON.stringify({
          message: `Rétention AuraFLOW : ${key}`,
          sha,
          branch: config.branch,
        }),
      });
      if (!response.ok) throw await githubError(response, `en supprimant ${key}`);
    },
  };
}

/* ------------------------------------------------------------------- local */

function localStore(directory: string): SnapshotStore {
  return {
    kind: "local",
    where: `disque local ${directory}`,
    // Le disque du conteneur est effacé à chaque déploiement : ce pilote ne
    // protège de rien en production, et l'écran doit le dire.
    durable: false,

    async list() {
      try {
        const names = await readdir(directory);
        const found: SnapshotMeta[] = [];
        for (const name of names) {
          const takenAt = dateFromKey(name);
          if (takenAt === null) continue;
          const info = await stat(path.join(directory, name));
          found.push({ key: name, takenAt, bytes: info.size });
        }
        return found;
      } catch {
        return [];
      }
    },

    async put(key, contents) {
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, key), contents, "utf8");
    },

    async get(key) {
      try {
        return await readFile(path.join(directory, key), "utf8");
      } catch {
        return null;
      }
    },

    async remove(key) {
      try {
        await unlink(path.join(directory, key));
      } catch {
        // Déjà absent : la rétention a atteint son but.
      }
    },
  };
}

/* ------------------------------------------------------------------ choix */

export type StoreResolution =
  | { readonly ok: true; readonly store: SnapshotStore }
  | { readonly ok: false; readonly message: string };

/**
 * Le magasin configuré.
 *
 * Aucun repli silencieux vers le disque local : une sauvegarde qu'on croit
 * partie chez GitHub et qui atterrit sur un disque effacé au prochain
 * déploiement est exactement le faux filet qu'on cherche à éviter. Mal
 * configuré, on le dit.
 */
export function resolveStore(): StoreResolution {
  const kind = process.env.SNAPSHOT_STORE?.trim() ?? "github";

  if (kind === "local") {
    const directory = process.env.SNAPSHOT_LOCAL_DIR?.trim() ?? "/tmp/auraflow-snapshots";
    return { ok: true, store: localStore(directory) };
  }

  if (kind === "github") {
    const config = githubConfig();
    if (config === null) {
      return {
        ok: false,
        message:
          "Sauvegardes non configurées : renseignez SNAPSHOT_GITHUB_REPO et SNAPSHOT_GITHUB_TOKEN dans les variables du service.",
      };
    }
    return { ok: true, store: githubStore(config) };
  }

  return { ok: false, message: `Magasin de sauvegardes inconnu : « ${kind} ».` };
}
