"use client";

import type { ContactRecord } from "@/lib/api/contacts";
import { CONTROL, Field } from "./form-field";

/**
 * Les coordonnées : qui c'est, et comment on le joint.
 *
 * Extraites du formulaire pour le ramener sous la limite de 250 lignes. Elles
 * forment un groupe naturel — ce sont les seuls champs qu'on remplit à la
 * création, et les seuls qu'un import renseigne.
 */

export function IdentityFields({
  contact,
  fields,
  brandOnly = false,
}: {
  contact: ContactRecord | null;
  fields: Readonly<Record<string, readonly string[]>>;
  /**
   * « Je n'ai pas encore le contact » : on a trouvé la marque avant le
   * fondateur. Les deux noms cessent d'être obligatoires — c'est la marque qui
   * porte l'identité, et le formulaire ne doit plus faire inventer un nom.
   */
  brandOnly?: boolean;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label={brandOnly ? "Prénom (si connu)" : "Prénom"} errors={fields.firstName}>
          <input
            name="firstName"
            required={!brandOnly}
            defaultValue={contact?.firstName ?? ""}
            className={CONTROL}
          />
        </Field>
        <Field label={brandOnly ? "Nom (si connu)" : "Nom"} errors={fields.lastName}>
          <input
            name="lastName"
            required={!brandOnly}
            defaultValue={contact?.lastName ?? ""}
            className={CONTROL}
          />
        </Field>
        <Field label="Fonction" errors={fields.title}>
          <input name="title" defaultValue={contact?.title ?? ""} className={CONTROL} />
        </Field>
        <Field label="Département" errors={fields.dep}>
          <input name="dep" defaultValue={contact?.dep ?? ""} className={CONTROL} />
        </Field>
        <Field label="Email" errors={fields.email}>
          <input name="email" type="email" defaultValue={contact?.email ?? ""} className={CONTROL} />
        </Field>
        <Field label="Téléphone" errors={fields.phone}>
          <input name="phone" defaultValue={contact?.phone ?? ""} className={CONTROL} />
        </Field>
      </div>

      <Field label="Site" errors={fields.website}>
        <input
          name="website"
          defaultValue={contact?.website ?? ""}
          placeholder="laisser vide pour reprendre le domaine de la société"
          className={CONTROL}
        />
      </Field>

      <Field label="LinkedIn" errors={fields.linkedin}>
        <input name="linkedin" defaultValue={contact?.linkedin ?? ""} className={CONTROL} />
      </Field>

      <Field label="Instagram" errors={fields.instagram}>
        {/* Le pseudo suffit : la valeur saisie n'est jamais réécrite, c'est
            l'affichage qui en fait un lien (lib/domain/instagram.ts). */}
        <input
          name="instagram"
          defaultValue={contact?.instagram ?? ""}
          placeholder="@maison_vertu — ou l'URL du profil"
          className={CONTROL}
        />
      </Field>
    </>
  );
}
