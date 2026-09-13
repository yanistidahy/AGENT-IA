import "server-only";
import { chromeUrl } from "../domain/logo-renditions";
import { readLogoSummary } from "./mail-logo";
import type { BrandLogo } from "@/components/brand/logo";

/**
 * Le logo de marque, tel que l'interface doit le poser — une seule lecture pour
 * les quatre surfaces.
 *
 * Le rail, la favicon, `/login` et la console du conseil lisent tous **ceci**,
 * et jamais la table directement. C'est la règle du jalon 15 appliquée à la
 * marque : la forme du logo est connue d'un seul endroit, sans quoi remplacer
 * le logo redeviendrait un geste à répéter écran par écran — exactement ce que
 * ce jalon supprime.
 *
 * `null` = aucun logo téléversé, et chaque surface retombe sur le tracé dessiné.
 * Le repli n'est pas un état d'erreur : une installation neuve n'a pas de logo
 * et doit malgré tout ressembler à quelque chose.
 *
 * Ne transporte **pas les octets** : seulement une adresse et un verdict. C'est
 * tout l'intérêt de la table séparée du jalon 62, et le rail est rendu à chaque
 * navigation.
 */
export async function readBrandLogo(): Promise<BrandLogo | null> {
  const summary = await readLogoSummary();
  if (summary === null) return null;

  const src = chromeUrl(summary.version);
  if (src === "") return null;

  // `onDark` est `null` pour un logo antérieur à la mesure : on ne pose alors
  // pas de plaque. Poser une plaque « au cas où » encadrerait de blanc un logo
  // clair qui n'en a pas besoin, et ce serait deviner dans l'autre sens.
  return { src, plate: summary.onDark?.plate ?? false };
}
