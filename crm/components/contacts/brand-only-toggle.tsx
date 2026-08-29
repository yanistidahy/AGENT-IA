"use client";

/**
 * « Je n'ai pas encore le contact ».
 *
 * La prospection Instagram trouve **la marque avant le fondateur** : on a le
 * compte, le site et l'adresse générique, et aucun nom. Sans cette bascule, le
 * formulaire fait inventer un nom — « — », « Contact », « Service client » —
 * qui se retrouve ensuite dans toutes les listes et qu'on ne sait plus
 * distinguer d'un vrai patronyme.
 *
 * Elle n'est proposée qu'à la **création** : sur une fiche existante, l'absence
 * de nom se lit dans la donnée (`isUnidentified`) et les champs sont de toute
 * façon facultatifs. Un interrupteur qui ne ferait que décrire un état déjà
 * visible serait un second endroit où le dire, donc un endroit de plus où se
 * contredire.
 */
export function BrandOnlyToggle({
  checked,
  onChange,
}: {
  readonly checked: boolean;
  readonly onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2.5 rounded-card border border-line bg-surface-2 px-3 py-2.5 max-lg:min-h-11">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-brand"
      />
      <span className="text-[13px]">
        Je n&apos;ai pas encore le contact
        <span className="mt-0.5 block text-[12px] text-muted">
          La marque est l&apos;identité de la fiche. Le nom de la personne se
          remplira quand vous l&apos;aurez trouvée — sans créer de seconde fiche.
        </span>
      </span>
    </label>
  );
}
