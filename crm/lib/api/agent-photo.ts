import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { prisma } from "../db";
import { findAgent } from "../agents/registry";
import {
  acceptPhotoUpload,
  PORTRAIT_BOX,
  THUMB_BOX,
  type PhotoSize,
} from "../domain/agent-identity";

/**
 * Traitement et stockage des portraits.
 *
 * L'image reçue n'est jamais conservée telle quelle : elle est décodée,
 * redimensionnée et **réencodée**. Trois raisons, dans l'ordre où elles
 * comptent :
 *
 * 1. un fichier réencodé par `sharp` ne transporte plus ni script, ni charge
 *    utile exotique, ni profil de couleur douteux — on sert nos octets, pas
 *    ceux d'un inconnu ;
 * 2. les métadonnées EXIF disparaissent, dont la géolocalisation qu'un
 *    téléphone glisse dans chaque photo ;
 * 3. le poids servi devient prévisible, quelle que soit la taille envoyée.
 */

export interface PhotoVariants {
  // `Uint8Array<ArrayBuffer>` et non `Buffer` : c'est le type exact qu'attend
  // Prisma pour une colonne `Bytes`. Le `Buffer` de Node porte un
  // `ArrayBufferLike`, qui admet aussi `SharedArrayBuffer` et ne s'y assigne
  // donc pas — d'où la conversion explicite par `Uint8Array.from`.
  readonly portraitWebp: Uint8Array<ArrayBuffer>;
  readonly portraitJpeg: Uint8Array<ArrayBuffer>;
  readonly thumbWebp: Uint8Array<ArrayBuffer>;
  readonly thumbJpeg: Uint8Array<ArrayBuffer>;
  readonly version: string;
}

/**
 * Produit les quatre variantes.
 *
 * `fit: "inside"` pour le portrait : l'image tient dans la boîte sans être
 * déformée, et `withoutEnlargement` évite d'étirer une petite photo en un flou
 * qui paraîtrait cassé. La vignette, elle, est un carré plein : `cover` avec
 * l'attention portée au haut du cadre, parce que c'est là qu'est un visage sur
 * un portrait.
 */
export async function buildVariants(source: Buffer): Promise<PhotoVariants> {
  const rotated = sharp(source, { failOn: "error" }).rotate();

  const portrait = rotated.clone().resize({
    width: PORTRAIT_BOX.width,
    height: PORTRAIT_BOX.height,
    fit: "inside",
    withoutEnlargement: true,
  });

  const thumb = rotated.clone().resize({
    width: THUMB_BOX.width,
    height: THUMB_BOX.height,
    fit: "cover",
    position: sharp.strategy.attention,
  });

  const [portraitWebp, portraitJpeg, thumbWebp, thumbJpeg] = await Promise.all([
    portrait.clone().webp({ quality: 82 }).toBuffer(),
    portrait.clone().jpeg({ quality: 82, mozjpeg: true }).toBuffer(),
    thumb.clone().webp({ quality: 80 }).toBuffer(),
    thumb.clone().jpeg({ quality: 80, mozjpeg: true }).toBuffer(),
  ]);

  return {
    portraitWebp: Uint8Array.from(portraitWebp),
    portraitJpeg: Uint8Array.from(portraitJpeg),
    thumbWebp: Uint8Array.from(thumbWebp),
    thumbJpeg: Uint8Array.from(thumbJpeg),
    version: createHash("sha256").update(source).digest("hex").slice(0, 16),
  };
}

export type StorePhotoResult =
  | { readonly ok: true; readonly version: string }
  | { readonly ok: false; readonly message: string };

/**
 * Valide puis enregistre un portrait.
 *
 * L'ordre des contrôles est celui du coût : type et poids d'abord — deux
 * comparaisons — puis le décodage, qui seul dit si les octets sont vraiment
 * une image. Un PDF renommé en `.jpg` franchit le premier contrôle et échoue
 * au second, avec un message qui le nomme.
 */
export async function storeAgentPhoto(
  slug: string,
  mime: string,
  source: Buffer,
): Promise<StorePhotoResult> {
  const definition = findAgent(slug);
  if (definition === undefined) return { ok: false, message: "Agent inconnu." };

  const accepted = acceptPhotoUpload(mime, source.byteLength);
  if (!accepted.ok) return accepted;

  let variants: PhotoVariants;
  try {
    variants = await buildVariants(source);
  } catch {
    return {
      ok: false,
      message:
        "Ce fichier n'est pas une image lisible. Vérifiez qu'il s'agit bien d'un JPEG, d'un PNG ou d'un WebP.",
    };
  }

  // L'agent doit exister en base pour porter la clé étrangère : une photo
  // envoyée avant que la migration ait semé sa ligne ne doit pas échouer sur
  // une contrainte que l'utilisateur ne peut pas comprendre.
  await prisma.agent.upsert({
    where: { slug },
    update: {},
    create: { slug, name: definition.name, role: definition.specialty },
  });

  const data = {
    sourceMime: accepted.mime,
    portraitWebp: variants.portraitWebp,
    portraitJpeg: variants.portraitJpeg,
    thumbWebp: variants.thumbWebp,
    thumbJpeg: variants.thumbJpeg,
    version: variants.version,
  };

  await prisma.agentPhoto.upsert({ where: { slug }, update: data, create: { slug, ...data } });

  return { ok: true, version: variants.version };
}

export async function deleteAgentPhoto(slug: string): Promise<void> {
  await prisma.agentPhoto.deleteMany({ where: { slug } });
}

export interface ServedPhoto {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly mime: string;
  readonly version: string;
}

/**
 * Lit la variante à servir.
 *
 * Le WebP n'est renvoyé que si le navigateur l'annonce ; sinon le JPEG, qui est
 * lu partout. C'est le sens du repli demandé : les deux encodages sont produits
 * à l'envoi, donc le choix au moment de servir ne coûte rien.
 */
export async function readAgentPhoto(
  slug: string,
  size: PhotoSize,
  acceptsWebp: boolean,
): Promise<ServedPhoto | null> {
  const row = await prisma.agentPhoto.findUnique({ where: { slug } });
  if (row === null) return null;

  const bytes =
    size === "portrait"
      ? acceptsWebp
        ? row.portraitWebp
        : row.portraitJpeg
      : acceptsWebp
        ? row.thumbWebp
        : row.thumbJpeg;

  return {
    bytes: Uint8Array.from(bytes),
    mime: acceptsWebp ? "image/webp" : "image/jpeg",
    version: row.version,
  };
}
