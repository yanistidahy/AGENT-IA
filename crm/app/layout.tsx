import type { Metadata } from "next";
import { IBM_Plex_Mono, Public_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { readBrandLogo } from "@/lib/api/brand-logo";

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-public-sans",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

/**
 * La favicon suit le logo téléversé, comme le rail et `/login`.
 *
 * `generateMetadata` plutôt qu'un objet figé : la favicon est de la **donnée**
 * depuis le jalon 63, pas une constante de build. Sans logo en base, rien n'est
 * déclaré ici et Next sert `app/icon.svg` — le tracé dessiné reste donc le
 * repli, exactement comme dans le rail.
 *
 * L'adresse porte la version : remplacer le logo change l'URL, ce qui est la
 * seule façon de déloger une favicon des caches de navigateur, réputés pour
 * garder l'ancienne bien après le remplacement.
 */
export async function generateMetadata(): Promise<Metadata> {
  const brand = await readBrandLogo().catch(() => null);

  return {
    // Le gabarit fait que chaque page garde la marque dans l'onglet : quinze
    // onglets ouverts et « Contacts » tout seul ne dit pas de quel outil il vient.
    title: { default: "AuraFLOW CRM", template: "%s · AuraFLOW CRM" },
    description: "CRM et conseil d'agents IA d'AuraFLOW AI.",
    ...(brand === null ? {} : { icons: { icon: [{ url: brand.src, type: "image/png" }] } }),
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="fr"
      className={`${publicSans.variable} ${spaceGrotesk.variable} ${ibmPlexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
