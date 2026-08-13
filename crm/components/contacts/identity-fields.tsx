"use client";

import type { ContactRecord } from "@/lib/api/contacts";

/**
 * Les coordonnées : qui c'est, et comment on le joint.
 *
 * Extraites du formulaire pour le ramener sous la limite de 250 lignes. Elles
 * forment un groupe naturel — ce sont les seuls champs qu'on remplit à la
 * création, et les seuls qu'un import renseigne.
 */
const CONTROL =
  "w-full rounded-control border border-line bg-surface px-2.5 py-2 text-[14px] outline-none focus:border-brand";

function Field({
  label,
  errors,
  children,
}: {
  label: string;
  errors?: readonly string[];
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1">
      <span className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">{label}</span>
      {children}
      {errors !== undefined &&
        errors.map((message) => (
          <span key={message} className="text-[12px] text-[#B2311F]">
            {message}
          </span>
        ))}
    </label>
  );
}

export function IdentityFields({
  contact,
  fields,
}: {
  contact: ContactRecord | null;
  fields: Readonly<Record<string, readonly string[]>>;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Prénom" errors={fields.firstName}>
          <input name="firstName" required defaultValue={contact?.firstName ?? ""} className={CONTROL} />
        </Field>
        <Field label="Nom" errors={fields.lastName}>
          <input name="lastName" required defaultValue={contact?.lastName ?? ""} className={CONTROL} />
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
    </>
  );
}
