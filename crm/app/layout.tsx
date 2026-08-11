import type { Metadata } from "next";
import { IBM_Plex_Mono, Public_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  // Le gabarit fait que chaque page garde la marque dans l'onglet : quinze
  // onglets ouverts et « Contacts » tout seul ne dit pas de quel outil il vient.
  title: { default: "AuraFLOW CRM", template: "%s · AuraFLOW CRM" },
  description: "CRM et conseil d'agents IA d'AuraFLOW AI.",
};

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
