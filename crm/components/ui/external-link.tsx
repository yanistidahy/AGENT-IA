import { externalLabel, externalUrl } from "@/lib/domain/links";

/**
 * Lien vers une adresse saisie sans schéma.
 *
 * Un seul composant pour toutes les surfaces — fiche contact, fiche société,
 * tableaux. La valeur importée d'un tableur s'écrit `linkedin.com/in/…` ou
 * `zenithlabs.fr`, sans `https://` ; laissée telle quelle dans un `href`, elle
 * est lue comme un chemin relatif et mène à une page inexistante du CRM. La
 * normalisation vit dans `lib/domain/links.ts` et n'est jamais réécrite en base :
 * l'export doit rester fidèle à ce qui a été importé.
 *
 * `target="_blank"` avec `rel="noopener noreferrer"` : le second est ce qui
 * empêche la page ouverte d'accéder à `window.opener`.
 */
export function ExternalLink({
  value,
  className = "text-flux-d hover:underline",
}: {
  value: string;
  className?: string;
}) {
  const href = externalUrl(value);
  if (href === null) return <>{value.trim() === "" ? "—" : value}</>;

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {externalLabel(value)}
    </a>
  );
}
