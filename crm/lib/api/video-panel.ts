import "server-only";
import { readVideoSummary } from "./mail-video";
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
  if (summary === null) {
    return { video: null, posterUrl: "", destination: "", warnings: [] };
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
  };
}
