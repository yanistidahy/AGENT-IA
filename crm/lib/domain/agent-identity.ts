/**
 * Identité d'agent — la part pure.
 *
 * Ce module ne connaît ni Prisma, ni React, ni `sharp`. Il porte les valeurs
 * contraintes et les règles de validation d'un portrait, pour qu'elles soient
 * testables sans base et sans fichier image.
 */

export const SHIFT_CADENCES = ["none", "daily", "weekly"] as const;
export type ShiftCadence = (typeof SHIFT_CADENCES)[number];

export const CADENCE_LABELS: Record<ShiftCadence, string> = {
  none: "Aucune vacation",
  daily: "Tous les jours",
  weekly: "Une fois par semaine",
};

export const PHOTO_SIZES = ["portrait", "thumb"] as const;
export type PhotoSize = (typeof PHOTO_SIZES)[number];

export function isPhotoSize(value: string): value is PhotoSize {
  return PHOTO_SIZES.some((candidate) => candidate === value);
}

/** Portrait : tient dans 600×900 sans être déformé ni agrandi. */
export const PORTRAIT_BOX = { width: 600, height: 900 } as const;
/** Vignette : carré plein, recadré sur le centre haut — c'est là qu'est le visage. */
export const THUMB_BOX = { width: 128, height: 128 } as const;

/** Plafond avant redimensionnement. Au-delà, on refuse sans décoder. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Types acceptés à l'envoi.
 *
 * Liste **fermée**. Accepter « tout ce qui commence par image/ » ferait entrer
 * SVG, qui n'est pas une image mais un document capable de porter du script :
 * servi depuis notre propre domaine, il s'exécuterait dans la session.
 */
export const ACCEPTED_UPLOAD_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AcceptedUploadMime = (typeof ACCEPTED_UPLOAD_MIMES)[number];

export function isAcceptedUploadMime(value: string): value is AcceptedUploadMime {
  return ACCEPTED_UPLOAD_MIMES.some((candidate) => candidate === value);
}

export type PhotoRejection = { readonly ok: false; readonly message: string };
export type PhotoAcceptance = { readonly ok: true; readonly mime: AcceptedUploadMime };

/**
 * Le fichier est-il recevable ?
 *
 * Vérifié **avant** tout décodage : refuser 40 Mo coûte une comparaison
 * d'entiers, les décoder coûte de la mémoire qu'un conteneur n'a pas forcément.
 * Le message nomme la limite et le poids réel — « fichier trop lourd » sans
 * chiffre n'aide personne à savoir quoi faire.
 */
export function acceptPhotoUpload(
  mime: string,
  bytes: number,
): PhotoAcceptance | PhotoRejection {
  if (!isAcceptedUploadMime(mime)) {
    return {
      ok: false,
      message: `Format non accepté (${mime === "" ? "type inconnu" : mime}). Envoyez une image JPEG, PNG ou WebP.`,
    };
  }
  if (bytes <= 0) {
    return { ok: false, message: "Le fichier est vide." };
  }
  if (bytes > MAX_UPLOAD_BYTES) {
    const mo = (bytes / (1024 * 1024)).toFixed(1);
    return { ok: false, message: `Image trop lourde (${mo} Mo). La limite est de 5 Mo.` };
  }
  return { ok: true, mime };
}

/**
 * Texte alternatif d'un portrait.
 *
 * Centralisé pour qu'aucune des trois surfaces qui affichent un agent ne puisse
 * livrer une image muette : la description doit nommer la personne *et* son
 * rôle, sinon elle n'apprend rien à qui ne voit pas l'image.
 */
export function portraitAlt(name: string, role: string): string {
  return role.trim() === "" ? `Portrait de ${name}` : `Portrait de ${name}, ${role}`;
}

/**
 * URL du portrait, jeton de version compris.
 *
 * La version est dans l'URL **exprès** : c'est elle qui autorise un cache long
 * côté navigateur. Sans elle, il faudrait revalider à chaque affichage pour ne
 * pas servir l'ancienne photo après un remplacement.
 */
export function photoUrl(slug: string, size: PhotoSize, version: string): string {
  const query = version === "" ? "" : `&v=${encodeURIComponent(version)}`;
  return `/api/agents/${encodeURIComponent(slug)}/photo?size=${size}${query}`;
}
