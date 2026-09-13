import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { prisma } from "../db";
import { LOGO_WIDTH } from "../domain/signature-logo";

/**
 * Le logo de la signature : validation, normalisation, stockage, lecture.
 *
 * Le fichier reçu n'est **jamais** conservé tel quel — décodé, redimensionné à
 * `LOGO_WIDTH`, réencodé en PNG. Les trois raisons du jalon 15 valent ici mot
 * pour mot : on sert nos octets et non ceux d'un inconnu, les métadonnées
 * partent avec le réencodage, et le poids servi devient prévisible quelle que
 * soit la taille envoyée. Une quatrième s'y ajoute : ce fichier part dans des
 * courriels, et son poids est une question de délivrabilité, pas de confort.
 */

/** 5 Mo à l'entrée. Le fichier servi en pèsera quelques milliers. */
export const MAX_LOGO_UPLOAD = 5 * 1024 * 1024;

/**
 * Les types acceptés à l'entrée. **SVG en est exclu**, et c'est le seul refus
 * qui mérite une phrase : c'est une image pour un navigateur, mais un document
 * capable de porter du script (jalon 15). Les clients de messagerie le bloquent
 * d'ailleurs presque tous, un logo SVG ne s'afficherait nulle part.
 */
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"] as const;

export interface StoredLogo {
  readonly png: Buffer;
  readonly width: number;
  readonly bytes: number;
  readonly version: string;
  readonly updatedAt: Date;
}

export type StoreLogoResult =
  | { readonly ok: true; readonly version: string; readonly bytes: number }
  | { readonly ok: false; readonly message: string };

/**
 * Valide puis enregistre le logo.
 *
 * L'ordre des contrôles suit leur coût : le type déclaré et le poids d'abord,
 * deux comparaisons ; le décodage ensuite, qui seul dit si les octets sont
 * vraiment une image — un PDF renommé en `image/png` ne se voit qu'ici.
 */
export async function storeMailLogo(
  source: Buffer,
  declaredMime: string,
): Promise<StoreLogoResult> {
  const mime = declaredMime.toLowerCase().trim();
  if (!ACCEPTED.some((accepted) => accepted === mime)) {
    return {
      ok: false,
      message:
        mime === "image/svg+xml"
          ? "SVG refusé : un SVG peut porter du script, et les clients de messagerie ne l'affichent pas. Envoyez un PNG."
          : `Format non accepté (${declaredMime}). Envoyez un PNG, un JPEG ou un WebP.`,
    };
  }

  if (source.byteLength > MAX_LOGO_UPLOAD) {
    const mo = (source.byteLength / (1024 * 1024)).toFixed(1);
    return { ok: false, message: `Image trop lourde (${mo} Mo). La limite est de 5 Mo.` };
  }

  let png: Buffer;
  let width: number;
  try {
    // `withoutEnlargement` : un logo déjà plus petit que 120 px n'est pas
    // étiré en un flou qui paraîtrait cassé. `palette` réduit un aplat de
    // marque à quelques couleurs indexées, ce qui fait l'essentiel du poids.
    const resized = sharp(source, { failOn: "error" })
      .resize({ width: LOGO_WIDTH, withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: true });

    png = await resized.toBuffer();
    width = (await sharp(png).metadata()).width ?? LOGO_WIDTH;
  } catch {
    return {
      ok: false,
      message: "Ce fichier n'est pas une image lisible. Envoyez un PNG, un JPEG ou un WebP.",
    };
  }

  // L'empreinte porte sur le fichier **d'origine** : deux envois du même
  // fichier donnent la même version, donc la même URL, donc le cache tient.
  const version = createHash("sha256").update(source).digest("hex").slice(0, 16);
  // `Uint8Array<ArrayBuffer>` et non `Buffer` : c'est le type exact qu'attend
  // Prisma pour une colonne `Bytes` — même conversion qu'au jalon 15.
  const bytes = Uint8Array.from(png);

  await prisma.mailLogo.upsert({
    where: { id: "singleton" },
    update: { sourceMime: mime, png: bytes, width, bytes: png.byteLength, version },
    create: {
      id: "singleton",
      sourceMime: mime,
      png: bytes,
      width,
      bytes: png.byteLength,
      version,
    },
  });

  return { ok: true, version, bytes: png.byteLength };
}

/** Les octets servis. `null` = aucun logo posé. */
export async function readMailLogo(): Promise<StoredLogo | null> {
  const row = await prisma.mailLogo.findUnique({ where: { id: "singleton" } });
  if (row === null) return null;

  return {
    png: Buffer.from(row.png),
    width: row.width,
    bytes: row.bytes,
    version: row.version,
    updatedAt: row.updatedAt,
  };
}

/**
 * Ce que l'écran et le composeur ont besoin de savoir, **sans les octets**.
 *
 * C'est la raison d'être de la table séparée : `readMailConfig` est appelée à
 * chaque rédaction et à chaque envoi, elle n'a aucune raison de transporter une
 * image à chaque fois.
 */
export interface LogoSummary {
  readonly version: string;
  readonly width: number;
  readonly bytes: number;
  readonly updatedAt: Date;
}

export async function readLogoSummary(): Promise<LogoSummary | null> {
  const row = await prisma.mailLogo.findUnique({
    where: { id: "singleton" },
    select: { version: true, width: true, bytes: true, updatedAt: true },
  });
  return row;
}

export async function deleteMailLogo(): Promise<void> {
  await prisma.mailLogo.deleteMany({ where: { id: "singleton" } });
}
