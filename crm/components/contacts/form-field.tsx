"use client";

/**
 * Un champ de formulaire de contact, avec ses erreurs par champ.
 *
 * Extrait parce qu'il était écrit **deux fois** — dans le formulaire et dans
 * les coordonnées — à deux détails de style près. Une validation serveur qui
 * n'aboutit qu'à un message global oblige à deviner laquelle des douze saisies
 * est en cause : c'est la raison d'être du composant, et elle ne gagne rien à
 * exister en double.
 */
export const CONTROL =
  "w-full rounded-control border border-line bg-surface px-2.5 py-2 text-[13.5px] outline-none focus:border-brand";

export function Field({
  label,
  errors,
  children,
}: {
  readonly label: string;
  readonly errors?: readonly string[];
  readonly children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
        {label}
      </span>
      {children}
      {errors !== undefined && errors.length > 0 && (
        <span className="mt-1 block text-[12px] text-[#B2311F]">{errors.join(" · ")}</span>
      )}
    </label>
  );
}
