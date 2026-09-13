import "server-only";
import { readLogoSummary } from "./mail-logo";
import { logoUrl, logoWeight } from "../domain/signature-logo";
import { publicBaseUrl } from "./email-sends";
import type { LogoState } from "@/components/settings/logo-panel";

/**
 * Ce que le panneau du logo affiche — **une seule composition**.
 *
 * Elle était écrite deux fois : dans la route qui téléverse et dans la page de
 * réglages. Les deux rendaient alors le même objet, et le jour où l'une gagne un
 * champ que l'autre ignore, l'écran affiche une chose après un téléversement et
 * une autre après un rechargement, sans que rien n'échoue. C'est exactement le
 * motif que ce projet a payé au jalon 55 sur l'entonnoir des campagnes.
 */
export async function readLogoPanelState(): Promise<LogoState> {
  const summary = await readLogoSummary();
  if (summary === null) return { logo: null, url: "", warnings: [] };

  // Le corps du message n'est pas connu ici : le verdict ne porte donc que sur
  // le poids absolu. La part « le message est trop court » se calcule à la
  // rédaction, là où le texte existe.
  const verdict = logoWeight({ logoBytes: summary.bytes, bodyChars: 0 });

  return {
    logo: {
      version: summary.version,
      width: summary.width,
      bytes: summary.bytes,
      chromeWidth: summary.chromeWidth,
      chromeFromEmail: summary.chromeFromEmail,
      onDark:
        summary.onDark === null
          ? null
          : { readable: summary.onDark.readable, message: summary.onDark.message },
    },
    // Vide quand aucune adresse publique n'est connue : l'écran doit pouvoir
    // dire que le logo ne partira pas dans les courriels, plutôt que d'afficher
    // un lien mort. Le rail, lui, passe par un chemin relatif et s'en moque.
    url: logoUrl(publicBaseUrl(), summary.version),
    warnings: verdict.reasons,
  };
}
