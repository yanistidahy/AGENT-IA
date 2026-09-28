"use client";

import { ourSiteLink, splitOurSiteLink } from "@/lib/domain/our-site";

/**
 * Le message rendu, tel que le destinataire le lira.
 *
 * Le texte vient de `renderTemplate` : rien n'est substitué ici. La seule chose
 * que ce composant ajoute, c'est l'ancre de notre site — l'aperçu doit montrer
 * un lien cliquable, puisque c'est ce qui partira en `text/html` (jalon 98). Le
 * libellé et l'adresse viennent de `ourSiteLink`, la même fonction que l'envoi,
 * pour qu'un aperçu ne puisse pas afficher un domaine et pointer ailleurs.
 */
export function RenderedBody({
  text,
  ourSiteUrl,
}: {
  readonly text: string;
  readonly ourSiteUrl: string;
}) {
  const parts = splitOurSiteLink(text, ourSiteLink(ourSiteUrl));

  return (
    <pre className="whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-ink">
      {parts.before}
      {parts.link !== null && (
        <a
          data-our-site
          href={parts.link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand underline"
        >
          {parts.link.label}
        </a>
      )}
      {parts.after}
    </pre>
  );
}
