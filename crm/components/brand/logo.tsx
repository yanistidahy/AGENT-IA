/**
 * La marque AuraFLOW, en un seul fichier.
 *
 * **Ce tracé est une reconstruction, pas un calque.** Le fichier source du logo
 * ne m'a jamais été accessible en tant que fichier : je l'ai vu, je n'ai pas pu
 * le lire, et aucun vectoriseur n'est installé ici. Le dessin ci-dessous suit la
 * description — un « A » traversé par une vague cyan → bleu → violet — sans
 * prétendre en reproduire les courbes exactes.
 *
 * Il est isolé ici pour que le remplacement soit trivial : déposer le SVG
 * définitif et changer le corps de `Mark` suffit. Aucun autre fichier ne connaît
 * la forme du logo — le rail, la page de connexion, la console de conseil et la
 * favicon passent tous par ce composant (la favicon par `app/icon.svg`, qui
 * porte le même tracé et doit être modifiée en même temps).
 *
 * Le fond est transparent : le rail bleu profond passe au travers, ce qui est
 * précisément ce que le carré blanc de l'image d'origine empêchait.
 */
export function Mark({
  size = 32,
  title,
}: {
  readonly size?: number;
  /** Fourni, le SVG devient une image nommée ; omis, il est décoratif. */
  readonly title?: string;
}) {
  // L'identifiant du dégradé doit être unique par instance : deux `<svg>` avec
  // le même `id` dans un document et c'est le premier qui l'emporte partout.
  const id = `aura-wave-${size}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role={title === undefined ? "presentation" : "img"}
      aria-hidden={title === undefined ? true : undefined}
      aria-label={title}
      className="shrink-0"
    >
      <defs>
        <linearGradient id={id} x1="2" y1="22" x2="30" y2="17" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#26D3E8" />
          <stop offset="0.52" stopColor="#3B6FEA" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>

      {/* Le « A ». `currentColor` : blanc sur le rail, encre sur fond clair. */}
      <path
        d="M5 27.5 L16 4.5 L27 27.5"
        stroke="currentColor"
        strokeWidth="3.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* La vague, qui tient lieu de barre. */}
      <path
        d="M2.5 20.4 C 7 15.6, 11.5 24.6, 16 20.4 S 25 16, 29.5 19.4"
        stroke={`url(#${id})`}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * La marque et le mot, tels qu'ils apparaissent en haut du rail.
 *
 * `tone` existe parce que le même verrou sert sur deux fonds : bleu profond
 * dans l'application, blanc sur `/login`. Le « A » suit `currentColor`, la
 * vague garde son dégradé dans les deux cas.
 */
export function Wordmark({
  tone = "dark",
  size = 32,
}: {
  readonly tone?: "dark" | "light";
  readonly size?: number;
}) {
  const onDark = tone === "dark";

  return (
    <span className={`flex items-center gap-2.5 ${onDark ? "text-white" : "text-ink"}`}>
      <Mark size={size} title="AuraFLOW" />
      <span className="font-display text-[15px] leading-tight font-bold tracking-tight">
        AuraFLOW
        <span
          className={`mt-0.5 block font-mono text-[9.5px] font-normal tracking-[0.14em] uppercase ${
            onDark ? "text-brand-lift" : "text-brand-d"
          }`}
        >
          CRM
        </span>
      </span>
    </span>
  );
}
