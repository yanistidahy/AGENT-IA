import "server-only";
import { prisma } from "../db";
import { readVideoSummary } from "./mail-video";
import { resyncAllManualDepartures } from "./manual-resync";
import {
  DEFAULT_VIDEO_DISPLAY,
  toVideoDisplay,
  type VideoDisplay,
} from "../domain/video-display";
import { posterUrl, staysOnOurDomain, videoDestination } from "../domain/signature-video";
import { publicBaseUrl } from "./email-sends";
import type { VideoState } from "@/components/settings/video-panel";

/**
 * Ce que le panneau de la vidéo affiche — **une seule composition**.
 *
 * Même raison qu'au jalon 62 pour le logo : écrite deux fois, dans la route qui
 * téléverse et dans la page de réglages, elle finirait par rendre une chose
 * après un téléversement et une autre après un rechargement, sans que rien
 * n'échoue.
 *
 * Les deux adresses sont **absolues** : ce sont celles qui partiront dans les
 * messages, et c'est précisément ce qu'on veut relire avant d'envoyer. Vides
 * quand aucune adresse publique n'est connue — l'écran dit alors que la vidéo ne
 * partira pas, plutôt que d'afficher un lien mort. L'aperçu de la vignette, lui,
 * passe par un **chemin relatif** côté composant : le navigateur qui affiche cet
 * écran parle déjà au CRM, et faire dépendre l'aperçu de `CRM_PUBLIC_URL` le
 * ferait disparaître au moment précis où l'on veut vérifier l'image qu'on vient
 * de choisir (le défaut trouvé au jalon 62).
 */
export async function readVideoPanelState(): Promise<VideoState> {
  const summary = await readVideoSummary();
  const display = await readVideoDisplay();
  if (summary === null) {
    return { video: null, posterUrl: "", destination: "", warnings: [], display };
  }

  const base = publicBaseUrl();

  return {
    video: {
      kind: summary.kind,
      url: summary.url,
      label: summary.label,
      version: summary.version,
      posterWidth: summary.posterWidth,
      posterBytes: summary.posterBytes,
      posterGenerated: summary.posterGenerated,
      fileBytes: summary.fileBytes,
      fileMime: summary.fileMime,
      // La seule différence entre les deux voies qui ait une conséquence pour
      // le destinataire, donc la seule qui mérite d'être à l'écran.
      ourDomain: staysOnOurDomain(summary.kind),
    },
    posterUrl: posterUrl(base, summary.version),
    destination: videoDestination(
      { kind: summary.kind, url: summary.url, version: summary.version },
      base,
    ),
    warnings: summary.weight.reasons,
    display,
  };
}

/** Le mode réglé, ou le lien texte : une valeur inconnue ne lève jamais. */
export async function readVideoDisplay(): Promise<VideoDisplay> {
  const row = await prisma.settings.findUnique({
    where: { id: "singleton" },
    select: { videoDisplay: true },
  });
  return row === null ? DEFAULT_VIDEO_DISPLAY : toVideoDisplay(row.videoDisplay);
}

/**
 * Écrit le mode, et **resynchronise les départs manuels en attente**.
 *
 * Le mode seul ne change pas le texte stocké d'un départ : `{video}` substitue
 * le **libellé**, et c'est l'assemblage MIME que le mode gouverne. Mais le
 * libellé se règle dans le même panneau, et lui change bien le corps rendu :
 * la file doit donc suivre l'enregistrement, comme elle suit celui d'une
 * séquence (jalon 97). Une retouche à la main est conservée et comptée.
 *
 * Aucun départ n'est créé : enregistrer un réglage ne doit pas écrire un premier
 * message à quelqu'un qui se trouve seulement être dû ce matin.
 */
export async function saveVideoDisplay(
  raw: string,
): Promise<{ readonly display: VideoDisplay; readonly updated: number; readonly kept: number }> {
  const display = toVideoDisplay(raw);
  await prisma.settings.update({ where: { id: "singleton" }, data: { videoDisplay: display } });
  const resync = await resyncAllManualDepartures();
  return { display, updated: resync.updated, kept: resync.kept };
}
