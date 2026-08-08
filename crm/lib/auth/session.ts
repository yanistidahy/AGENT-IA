/**
 * Jetons de session : signature, vérification, comparaison à temps constant.
 *
 * Aucune session n'est stockée en base. Le jeton porte sa propre date
 * d'expiration et une signature HMAC-SHA256 : le serveur peut le vérifier sans
 * rien lire, et un jeton fabriqué de toutes pièces est rejeté faute de clé.
 *
 * Tout passe par la Web Crypto API (`crypto.subtle`), disponible aussi bien dans
 * le runtime Node des routes que dans le runtime Edge du middleware. Utiliser
 * `node:crypto` interdirait au middleware de vérifier lui-même le jeton — et
 * c'est précisément le middleware qui doit décider, puisqu'il voit *toutes* les
 * requêtes.
 */

const VERSION = "v1";
const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function sign(secret: string, message: string): Promise<string> {
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return base64url(new Uint8Array(signature));
}

/**
 * Comparaison à temps constant.
 *
 * La boucle parcourt toujours la totalité de la plus longue des deux chaînes et
 * accumule les différences au lieu de sortir au premier écart : le temps de
 * réponse ne dit rien du nombre de caractères corrects, ce qui interdit de
 * reconstituer un secret octet par octet.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  const length = Math.max(left.length, right.length);

  let diff = left.length ^ right.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Vérifie le mot de passe saisi.
 *
 * On compare les **empreintes HMAC** plutôt que les chaînes elles-mêmes : deux
 * empreintes font toujours la même longueur, si bien que la comparaison ne
 * divulgue pas non plus la longueur du mot de passe attendu.
 */
export async function passwordMatches(candidate: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    sign(expected, `password:${candidate}`),
    sign(expected, `password:${expected}`),
  ]);
  return constantTimeEqual(a, b);
}

/** Émet un jeton valable `maxAgeSeconds`, signé par le mot de passe de l'espace. */
export async function issueToken(
  secret: string,
  maxAgeSeconds: number,
  now: number = Date.now(),
): Promise<string> {
  const expiry = now + maxAgeSeconds * 1000;
  const payload = `${VERSION}.${expiry}`;
  return `${payload}.${await sign(secret, payload)}`;
}

/**
 * Vérifie un jeton. `false` au moindre doute — forme, version, signature, date.
 *
 * Changer `WORKSPACE_PASSWORD` change la clé de signature : toutes les sessions
 * existantes deviennent invalides. C'est voulu — c'est le seul moyen de
 * révoquer un accès quand il n'y a pas de comptes.
 */
export async function verifyToken(
  secret: string,
  token: string | undefined,
  now: number = Date.now(),
): Promise<boolean> {
  if (typeof token !== "string") return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [version, expiryText, signature] = parts;
  if (version !== VERSION) return false;
  if (expiryText === undefined || signature === undefined) return false;

  const expiry = Number(expiryText);
  if (!Number.isFinite(expiry)) return false;

  // La signature est vérifiée *avant* l'expiration, et le résultat des deux
  // contrôles est combiné : répondre plus vite sur un jeton périmé apprendrait
  // à un attaquant que sa signature, elle, était bonne.
  const expected = await sign(secret, `${version}.${expiryText}`);
  const signatureOk = constantTimeEqual(signature, expected);

  return signatureOk && expiry > now;
}
