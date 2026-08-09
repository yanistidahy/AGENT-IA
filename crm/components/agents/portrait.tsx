import { photoUrl, portraitAlt, type PhotoSize } from "@/lib/domain/agent-identity";

/**
 * Portrait d'agent, avec repli sur des initiales.
 *
 * Le repli est **généré, pas téléchargé** : ni requête, ni fichier, ni instant
 * où la case reste vide. Un agent sans photo occupe donc exactement la même
 * place qu'un agent qui en a une — c'est ce qui empêche la mise en page de
 * sauter quand on ajoute un portrait.
 *
 * Composant serveur : il ne rend qu'une balise `img` ou un bloc coloré, sans
 * état ni gestionnaire d'évènement. Rien de tout cela n'a besoin du navigateur.
 */
export interface PortraitAgent {
  readonly slug: string;
  readonly name: string;
  readonly role: string;
  readonly initials: string;
  readonly color: string;
  readonly hasPhoto: boolean;
  readonly photoVersion: string;
  readonly locked?: boolean;
}

interface PortraitProps {
  readonly agent: PortraitAgent;
  readonly size: PhotoSize;
  /** Classes de cadrage, imposées par l'appelant : la forme dépend de l'écran. */
  readonly className?: string;
  /** Taille du texte du repli, pour qu'il suive la taille du cadre. */
  readonly initialsClassName?: string;
}

export function Portrait({ agent, size, className = "", initialsClassName }: PortraitProps) {
  // Le verrou se lit d'abord à la désaturation, avant même le cadenas : c'est
  // une information de disponibilité, elle doit se voir sans être lue.
  const locked = agent.locked === true ? "grayscale opacity-55" : "";
  const shell = `relative overflow-hidden bg-surface-2 ${locked} ${className}`;

  if (!agent.hasPhoto) {
    return (
      <div
        className={`${shell} grid place-items-center`}
        style={{ backgroundColor: agent.color }}
        role="img"
        aria-label={portraitAlt(agent.name, agent.role)}
      >
        <span
          aria-hidden
          className={`font-display font-semibold text-white ${initialsClassName ?? "text-[13px]"}`}
        >
          {agent.initials}
        </span>
      </div>
    );
  }

  return (
    <div className={shell}>
      {/* eslint-disable-next-line @next/next/no-img-element -- l'image vient de
          notre propre route dynamique : `next/image` n'apporterait qu'un second
          étage de cache devant des octets déjà redimensionnés et versionnés. */}
      <img
        src={photoUrl(agent.slug, size, agent.photoVersion)}
        alt={portraitAlt(agent.name, agent.role)}
        className="size-full object-cover"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
