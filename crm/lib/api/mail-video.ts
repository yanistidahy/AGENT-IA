import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { prisma } from "../db";
import {
  MAX_VIDEO_UPLOAD,
  VIDEO_POSTER_HEIGHT,
  VIDEO_POSTER_WIDTH,
  posterWeight,
  toVideoKind,
  type PosterWeightVerdict,
  type VideoKind,
} from "../domain/signature-video";

/**
 * **La vidéo de démonstration : validation, vignette, stockage, lecture.**
 *
 * Deux moitiés, et elles ne se traitent pas pareil (voir
 * `lib/domain/signature-video.ts`) : la **vignette** est toujours la nôtre,
 * réencodée comme le logo au jalon 62 ; la **destination du clic** est notre
 * domaine quand le fichier est téléversé, celle de l'hébergeur quand une adresse
 * est collée.
 *
 * Ce que le module ne fera jamais : composer une pièce jointe. La demande était
 * explicite et elle a raison — une vidéo attachée est l'un des signaux de spam
 * les plus forts, beaucoup de serveurs la mettent en quarantaine sans un mot, et
 * IONOS applique de toute façon sa propre limite de taille par message.
 *
 * ## Pourquoi la vignette est parfois engendrée
 *
 * Extraire une trame demande un décodeur vidéo, et **il n'y en a aucun ici** :
 * `ffmpeg` et `ffprobe` sont absents de l'environnement, et `sharp` ne décode
 * pas la vidéo. Plutôt que de prétendre montrer une image du film, on compose
 * une plaque sobre portant le triangle de lecture, et `posterGenerated` le dit à
 * l'écran. Inventer une capture aurait été le pire des deux mondes : une image
 * qui ressemble à une trame sans en être une.
 */

/**
 * Les types de vidéo acceptés à l'entrée.
 *
 * Trois conteneurs, et c'est délibérément court : ce fichier sera servi à un
 * navigateur depuis notre domaine, et ce sont les seuls que tous les
 * navigateurs lisent sans extension. Un `.mov` de motion design se réexporte en
 * MP4 en une manipulation ; un format exotique produirait un lien qui ne joue
 * chez personne, donc pire qu'un refus.
 */
const ACCEPTED_VIDEO = ["video/mp4", "video/webm", "video/ogg"] as const;

/** Les types d'image acceptés pour la vignette, comme pour le logo (jalon 62). */
const ACCEPTED_POSTER = ["image/png", "image/jpeg", "image/webp"] as const;

export interface StoreVideoInput {
  readonly kind: string;
  /** L'adresse collée, quand `kind = hosted`. */
  readonly url: string;
  readonly label: string;
  /** Le fichier vidéo, quand `kind = file`. */
  readonly file?: { readonly bytes: Buffer; readonly mime: string };
  /** L'image de vignette. Absente, elle est engendrée. */
  readonly poster?: { readonly bytes: Buffer; readonly mime: string };
}

export type StoreVideoResult =
  | {
      readonly ok: true;
      readonly version: string;
      readonly posterBytes: number;
      readonly posterGenerated: boolean;
      readonly weight: PosterWeightVerdict;
    }
  | { readonly ok: false; readonly message: string };

/**
 * Le triangle de lecture, en SVG, incrusté dans la vignette.
 *
 * **Dans les pixels, jamais en surcouche.** Une image surmontée d'un élément
 * positionné en absolu est rendue en pile par le moteur de Word, donc par
 * Outlook : le badge se retrouverait sous la vignette, chez une partie des
 * destinataires seulement — le pire des cas, invisible à la relecture. C'est la
 * leçon du tableau de signature du jalon 65, appliquée à une image.
 *
 * Disque translucide plutôt qu'opaque : il doit se lire sur une vignette claire
 * comme sur une vignette sombre, sans qu'on ait à mesurer laquelle des deux
 * c'est.
 */
function playBadge(width: number): Buffer {
  const size = Math.round(width * 0.22);
  const r = size / 2;
  // Un triangle légèrement décalé à droite : centré géométriquement, il se lit
  // comme décalé à gauche — l'œil pèse la pointe plus que la base.
  const side = size * 0.34;
  const x0 = r - side * 0.45;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<circle cx="${r}" cy="${r}" r="${r - 1}" fill="rgba(13,18,32,0.72)" />` +
    `<polygon points="${x0},${r - side} ${x0 + side * 1.6},${r} ${x0},${r + side}" fill="#ffffff" />` +
    `</svg>`;
  return Buffer.from(svg);
}

/**
 * La plaque servie quand aucune image n'est fournie.
 *
 * Un aplat de l'encre du produit, pas un dégradé : un dégradé coûterait des
 * dizaines de kilo-octets en JPEG pour une image qui ne montre rien.
 */
async function generatedPoster(): Promise<Buffer> {
  return sharp({
    create: {
      width: VIDEO_POSTER_WIDTH,
      height: VIDEO_POSTER_HEIGHT,
      channels: 3,
      background: { r: 13, g: 18, b: 32 },
    },
  })
    .composite([{ input: playBadge(VIDEO_POSTER_WIDTH), gravity: "center" }])
    .jpeg({ quality: 82, progressive: true })
    .toBuffer();
}

/**
 * La vignette servie, à partir d'une image fournie.
 *
 * `cover` et non `inside` : le rapport d'une vidéo est celui du cadre, et une
 * image d'un autre rapport doit être recadrée plutôt que bordée de bandes —
 * elles se liraient comme un défaut d'affichage dans un courriel.
 *
 * **JPEG et non PNG**, contrairement au logo : une vignette est une image
 * photographique, où le PNG palettisé du jalon 62 produirait du bruit et un
 * fichier plus lourd. L'image est **réencodée** à cette largeur, pas seulement
 * contrainte par un attribut — un client qui ignore `width` afficherait sinon
 * l'original en pleine page.
 */
async function posterFrom(source: Buffer): Promise<Buffer> {
  return sharp(source, { failOn: "error" })
    .resize({
      width: VIDEO_POSTER_WIDTH,
      height: VIDEO_POSTER_HEIGHT,
      fit: "cover",
      position: "attention",
    })
    .composite([{ input: playBadge(VIDEO_POSTER_WIDTH), gravity: "center" }])
    .jpeg({ quality: 82, progressive: true })
    .toBuffer();
}

/**
 * Valide puis enregistre la vidéo.
 *
 * L'ordre des contrôles suit leur coût, comme pour le logo : le type déclaré et
 * le poids d'abord, deux comparaisons ; le décodage de l'image ensuite, qui seul
 * dit si les octets sont vraiment une image.
 *
 * **On avertit sur le poids de la vignette, on ne refuse pas** (jalon 62) : le
 * seuil acceptable dépend d'un jugement qui n'appartient pas au code, mais rien
 * ne part plus en silence.
 */
export async function storeMailVideo(input: StoreVideoInput): Promise<StoreVideoResult> {
  const kind: VideoKind = toVideoKind(input.kind);
  const label = input.label.trim();
  const url = input.url.trim();

  if (label === "") {
    return {
      ok: false,
      message:
        "Le libellé est ce que `{video}` écrit dans le message, et c'est le mot sur lequel on clique : il ne peut pas être vide.",
    };
  }

  if (kind === "hosted" && !/^https?:\/\//i.test(url)) {
    return {
      ok: false,
      message:
        "Collez une adresse complète, commençant par https:// — une adresse partielle produirait un lien mort dans chaque message.",
    };
  }

  if (kind === "file" && input.file === undefined) {
    return { ok: false, message: "Aucun fichier reçu. Choisissez une vidéo, ou collez une adresse." };
  }

  if (input.file !== undefined) {
    const mime = input.file.mime.toLowerCase().trim();
    if (!ACCEPTED_VIDEO.some((accepted) => accepted === mime)) {
      return {
        ok: false,
        message: `Format vidéo non accepté (${input.file.mime}). Envoyez un MP4, un WebM ou un OGG — ce sont les seuls que tous les navigateurs lisent.`,
      };
    }
    if (input.file.bytes.byteLength > MAX_VIDEO_UPLOAD) {
      const mo = (input.file.bytes.byteLength / (1024 * 1024)).toFixed(0);
      const limite = (MAX_VIDEO_UPLOAD / (1024 * 1024)).toFixed(0);
      return {
        ok: false,
        message: `Vidéo trop lourde (${mo} Mo). La limite est de ${limite} Mo : au-delà, hébergez-la et collez son adresse.`,
      };
    }
  }

  if (input.poster !== undefined) {
    const mime = input.poster.mime.toLowerCase().trim();
    if (!ACCEPTED_POSTER.some((accepted) => accepted === mime)) {
      return {
        ok: false,
        message:
          mime === "image/svg+xml"
            ? "SVG refusé pour la vignette : un SVG peut porter du script, et les clients de messagerie ne l'affichent pas. Envoyez un PNG ou un JPEG."
            : `Format de vignette non accepté (${input.poster.mime}). Envoyez un PNG, un JPEG ou un WebP.`,
      };
    }
  }

  let poster: Buffer;
  let posterGenerated: boolean;
  try {
    if (input.poster === undefined) {
      poster = await generatedPoster();
      posterGenerated = true;
    } else {
      poster = await posterFrom(input.poster.bytes);
      posterGenerated = false;
    }
  } catch {
    return {
      ok: false,
      message: "Cette vignette n'est pas une image lisible. Envoyez un PNG, un JPEG ou un WebP.",
    };
  }

  // L'empreinte porte sur ce qui détermine les deux adresses servies : le
  // fichier s'il y en a un, l'adresse collée sinon, plus la vignette. Deux
  // envois du même matériau donnent la même version, donc la même URL, donc le
  // cache des messages déjà partis tient.
  const version = createHash("sha256")
    .update(input.file?.bytes ?? Buffer.from(url, "utf8"))
    .update(poster)
    .digest("hex")
    .slice(0, 16);

  const row = {
    kind,
    // Une adresse collée n'a aucun sens sur un fichier téléversé : la garder
    // laisserait deux destinations en base, et c'est toujours la seconde qui
    // finit par être lue.
    url: kind === "file" ? "" : url,
    file: input.file === undefined ? null : Uint8Array.from(input.file.bytes),
    fileMime: input.file?.mime.toLowerCase().trim() ?? "",
    fileBytes: input.file?.bytes.byteLength ?? 0,
    poster: Uint8Array.from(poster),
    posterMime: "image/jpeg",
    posterWidth: VIDEO_POSTER_WIDTH,
    posterBytes: poster.byteLength,
    posterGenerated,
    label,
    version,
  };

  await prisma.mailVideo.upsert({
    where: { id: "singleton" },
    update: row,
    create: { id: "singleton", ...row },
  });

  return {
    ok: true,
    version,
    posterBytes: poster.byteLength,
    posterGenerated,
    weight: posterWeight(poster.byteLength),
  };
}

/**
 * Ce que l'écran et le composeur ont besoin de savoir, **sans les octets**.
 *
 * C'est la raison d'être de la table séparée, comme pour le logo : cette lecture
 * a lieu à chaque envoi, et elle n'a aucune raison de transporter une vidéo de
 * deux cents mégaoctets.
 */
export interface VideoSummary {
  readonly kind: VideoKind;
  readonly url: string;
  readonly label: string;
  readonly version: string;
  readonly posterWidth: number;
  readonly posterBytes: number;
  readonly posterGenerated: boolean;
  readonly fileBytes: number;
  readonly fileMime: string;
  readonly updatedAt: Date;
  readonly weight: PosterWeightVerdict;
}

export async function readVideoSummary(): Promise<VideoSummary | null> {
  const row = await prisma.mailVideo.findUnique({
    where: { id: "singleton" },
    select: {
      kind: true,
      url: true,
      label: true,
      version: true,
      posterWidth: true,
      posterBytes: true,
      posterGenerated: true,
      fileBytes: true,
      fileMime: true,
      updatedAt: true,
    },
  });
  if (row === null) return null;

  return {
    kind: toVideoKind(row.kind),
    url: row.url,
    label: row.label,
    version: row.version,
    posterWidth: row.posterWidth,
    posterBytes: row.posterBytes,
    posterGenerated: row.posterGenerated,
    fileBytes: row.fileBytes,
    fileMime: row.fileMime,
    updatedAt: row.updatedAt,
    weight: posterWeight(row.posterBytes),
  };
}

export interface ServedBytes {
  readonly bytes: Buffer;
  readonly mime: string;
  readonly version: string;
}

/** Les octets de la vignette. `null` = aucune vidéo réglée. */
export async function readVideoPoster(): Promise<ServedBytes | null> {
  const row = await prisma.mailVideo.findUnique({
    where: { id: "singleton" },
    select: { poster: true, posterMime: true, version: true },
  });
  if (row === null) return null;
  return { bytes: Buffer.from(row.poster), mime: row.posterMime, version: row.version };
}

/** Les octets de la vidéo, quand c'est nous qui l'hébergeons. */
export async function readVideoFile(): Promise<ServedBytes | null> {
  const row = await prisma.mailVideo.findUnique({
    where: { id: "singleton" },
    select: { file: true, fileMime: true, version: true, kind: true },
  });
  if (row === null || row.file === null || toVideoKind(row.kind) !== "file") return null;
  return { bytes: Buffer.from(row.file), mime: row.fileMime, version: row.version };
}

export async function deleteMailVideo(): Promise<void> {
  await prisma.mailVideo.deleteMany({ where: { id: "singleton" } });
}
