import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { prisma } from "../db";
import { LOGO_WIDTH } from "../domain/signature-logo";
import {
  CHROME_WIDTH,
  readsOnDark,
  type DarkVerdict,
  type LogoInkSample,
} from "../domain/logo-renditions";

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
 * Ce que l'image contient réellement : la couleur moyenne de ce qu'on voit, et
 * la part de vide autour.
 *
 * **C'est une mesure, et elle existe pour ne pas avoir à deviner.** Un logo
 * dessiné pour du papier blanc — encre foncée, fond transparent — disparaît sur
 * le bleu nuit du rail, et cela ne se découvre qu'en regardant l'écran. On lit
 * donc les pixels une fois, au téléversement.
 *
 * Les pixels **entièrement transparents sont exclus de la moyenne** : les
 * compter ferait tendre la couleur d'un logo cerné de vide vers le noir (leurs
 * composantes RVB valent zéro sous un alpha nul), et un logo blanc sur fond
 * transparent serait déclaré illisible sur fond sombre — soit exactement
 * l'inverse de la vérité.
 */
async function sampleInk(source: Buffer): Promise<LogoInkSample> {
  // Une vignette suffit : on cherche une moyenne, pas un détail. Cela borne
  // aussi le coût sur un fichier de 5 Mo.
  const { data, info } = await sharp(source, { failOn: "error" })
    .resize({ width: 64, height: 64, fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let r = 0;
  let g = 0;
  let b = 0;
  let visible = 0;
  let clear = 0;
  const pixels = info.width * info.height;

  for (let i = 0; i < pixels; i += 1) {
    const at = i * info.channels;
    const alpha = data[at + 3] ?? 255;
    if (alpha < 16) {
      clear += 1;
      continue;
    }
    r += data[at] ?? 0;
    g += data[at + 1] ?? 0;
    b += data[at + 2] ?? 0;
    visible += 1;
  }

  // Aucun pixel visible : l'image est vide. On la déclare claire plutôt que
  // noire — une moyenne sur zéro pixel ne vaut rien, et le noir serait le pire
  // des deux verdicts possibles.
  if (visible === 0) return { r: 255, g: 255, b: 255, transparency: 1 };

  return {
    r: Math.round(r / visible),
    g: Math.round(g / visible),
    b: Math.round(b / visible),
    transparency: pixels === 0 ? 0 : clear / pixels,
  };
}

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
  let chrome: Buffer;
  let chromeWidth: number;
  let ink: LogoInkSample;
  try {
    // `withoutEnlargement` : un logo déjà plus petit que 120 px n'est pas
    // étiré en un flou qui paraîtrait cassé. `palette` réduit un aplat de
    // marque à quelques couleurs indexées, ce qui fait l'essentiel du poids.
    const resized = sharp(source, { failOn: "error" })
      .resize({ width: LOGO_WIDTH, withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: true });

    png = await resized.toBuffer();
    width = (await sharp(png).metadata()).width ?? LOGO_WIDTH;

    // Le rendu d'interface part du **même** fichier d'origine, jamais du PNG
    // de courriel : réencoder un réencodage empilerait deux pertes, et c'est
    // précisément l'image molle qu'on cherche à éviter. Pas de `palette` ici —
    // un dégradé de marque a besoin de ses couleurs, et le poids ne regarde
    // aucun filtre anti-spam.
    chrome = await sharp(source, { failOn: "error" })
      .resize({ width: CHROME_WIDTH, withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
    chromeWidth = (await sharp(chrome).metadata()).width ?? CHROME_WIDTH;

    ink = await sampleInk(source);
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

  const row = {
    sourceMime: mime,
    png: bytes,
    width,
    bytes: png.byteLength,
    version,
    chrome: Uint8Array.from(chrome),
    chromeWidth,
    chromeBytes: chrome.byteLength,
    // Ce rendu vient de l'original, pas du PNG de courriel : il est net, et
    // l'écran n'a aucune réserve à émettre.
    chromeFromEmail: false,
    inkR: ink.r,
    inkG: ink.g,
    inkB: ink.b,
    transparency: Math.round(ink.transparency * 1000),
  };

  await prisma.mailLogo.upsert({
    where: { id: "singleton" },
    update: row,
    create: { id: "singleton", ...row },
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
  /** Largeur du rendu d'interface. `0` tant qu'il n'a pas été calculé. */
  readonly chromeWidth: number;
  readonly chromeBytes: number;
  /** Le rendu d'interface est dérivé du PNG de courriel, donc adouci. */
  readonly chromeFromEmail: boolean;
  /**
   * Le logo se lit-il sur le rail ? `null` tant que rien n'a été mesuré — un
   * logo antérieur au jalon 63, dont on ne prétend rien savoir.
   */
  readonly onDark: DarkVerdict | null;
}

export async function readLogoSummary(): Promise<LogoSummary | null> {
  const row = await prisma.mailLogo.findUnique({
    where: { id: "singleton" },
    select: {
      version: true,
      width: true,
      bytes: true,
      updatedAt: true,
      chromeWidth: true,
      chromeBytes: true,
      chromeFromEmail: true,
      inkR: true,
      inkG: true,
      inkB: true,
      transparency: true,
    },
  });
  if (row === null) return null;

  const { inkR, inkG, inkB, transparency } = row;
  const measured =
    inkR !== null && inkG !== null && inkB !== null && transparency !== null
      ? readsOnDark({ r: inkR, g: inkG, b: inkB, transparency: transparency / 1000 })
      : null;

  return {
    version: row.version,
    width: row.width,
    bytes: row.bytes,
    updatedAt: row.updatedAt,
    chromeWidth: row.chromeWidth ?? 0,
    chromeBytes: row.chromeBytes ?? 0,
    chromeFromEmail: row.chromeFromEmail,
    onDark: measured,
  };
}

export interface ChromeLogo {
  readonly png: Buffer;
  readonly version: string;
  readonly width: number;
}

/**
 * Les octets servis à l'interface — rail, favicon, `/login`.
 *
 * **Calcule ce qui manque plutôt que de refuser.** Un logo téléversé avant le
 * jalon 63 n'a pas de rendu d'interface, et son fichier d'origine n'a jamais
 * été conservé : le seul matériau disponible est le PNG de courriel de 120 px.
 * On en dérive donc un rendu, on le range pour ne pas le refaire, et on lève
 * `chromeFromEmail` — l'écran de réglages annonce alors une image adoucie et
 * invite à retéléverser l'original. Refuser aurait obligé à fournir deux fois
 * le même fichier ; servir sans rien dire aurait laissé passer le flou en
 * silence. La mesure de lisibilité est faite au passage, sur la même source.
 */
export async function readChromeLogo(): Promise<ChromeLogo | null> {
  const row = await prisma.mailLogo.findUnique({ where: { id: "singleton" } });
  if (row === null) return null;

  if (row.chrome !== null && row.chromeWidth !== null) {
    return {
      png: Buffer.from(row.chrome),
      version: row.version,
      width: row.chromeWidth,
    };
  }

  const email = Buffer.from(row.png);
  let derived: Buffer;
  let width: number;
  let ink: LogoInkSample;
  try {
    // `withoutEnlargement` est délibérément **absent** : on veut bel et bien
    // agrandir, faute de mieux. C'est ce qui rend le résultat adouci, et c'est
    // exactement ce que `chromeFromEmail` sert à avouer.
    derived = await sharp(email, { failOn: "error" })
      .resize({ width: CHROME_WIDTH })
      .png({ compressionLevel: 9 })
      .toBuffer();
    width = (await sharp(derived).metadata()).width ?? CHROME_WIDTH;
    ink = await sampleInk(email);
  } catch {
    return null;
  }

  await prisma.mailLogo.update({
    where: { id: "singleton" },
    data: {
      chrome: Uint8Array.from(derived),
      chromeWidth: width,
      chromeBytes: derived.byteLength,
      chromeFromEmail: true,
      inkR: ink.r,
      inkG: ink.g,
      inkB: ink.b,
      transparency: Math.round(ink.transparency * 1000),
    },
  });

  return { png: derived, version: row.version, width };
}

export async function deleteMailLogo(): Promise<void> {
  await prisma.mailLogo.deleteMany({ where: { id: "singleton" } });
}
