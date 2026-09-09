"use client";

/**
 * Les champs d'une boîte d'envoi — la moitié « formulaire » du panneau.
 *
 * Séparés de la liste pour que chacun des deux fichiers tienne sous la limite
 * de 250 lignes, et parce que la liste décide (ajouter, retirer, enregistrer,
 * tester) là où ce composant ne fait qu'afficher et remonter des changements.
 */

export interface MailboxDraft {
  readonly id?: string;
  readonly slug: string;
  readonly label: string;
  readonly active: boolean;
  readonly smtpHost: string;
  readonly smtpPort: number;
  readonly smtpEncryption: "tls" | "starttls";
  readonly smtpUser: string;
  readonly smtpFrom: string;
  readonly smtpFromName: string;
  readonly imapHost: string;
  readonly imapPort: number;
  readonly imapSentMailbox: string;
  readonly imapCopyEnabled: boolean;
  readonly signName: string;
  readonly signTitle: string;
  readonly passwordEnv: string;
  readonly passwordSet: boolean;
}

const CONTROL =
  "w-full rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-brand";
const LABEL = "mb-1 block font-mono text-[10px] tracking-[0.1em] text-muted uppercase";

function Field({
  label,
  value,
  placeholder,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly placeholder?: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={CONTROL}
      />
    </label>
  );
}

export function MailboxFields({
  box,
  onChange,
}: {
  readonly box: MailboxDraft;
  readonly onChange: (change: Partial<MailboxDraft>) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field label="Hôte SMTP" value={box.smtpHost} placeholder="smtp.ionos.fr" onChange={(smtpHost) => onChange({ smtpHost })} />
        <div className="grid grid-cols-2 gap-2.5">
          <label className="block">
            <span className={LABEL}>Port</span>
            <input
              type="number"
              value={box.smtpPort}
              onChange={(event) => onChange({ smtpPort: Number(event.target.value) })}
              className={CONTROL}
            />
          </label>
          <label className="block">
            <span className={LABEL}>Chiffrement</span>
            <select
              value={box.smtpEncryption}
              onChange={(event) =>
                onChange({ smtpEncryption: event.target.value === "tls" ? "tls" : "starttls" })
              }
              className={CONTROL}
            >
              <option value="starttls">STARTTLS (587)</option>
              <option value="tls">TLS (465)</option>
            </select>
          </label>
        </div>
        <Field label="Identifiant" value={box.smtpUser} placeholder="contact@auraflowai.fr" onChange={(smtpUser) => onChange({ smtpUser })} />
        <Field label="Adresse d'expédition" value={box.smtpFrom} placeholder="contact@auraflowai.fr" onChange={(smtpFrom) => onChange({ smtpFrom })} />
        <Field label="Nom d'expédition" value={box.smtpFromName} placeholder="Yanis d'Aura Flow" onChange={(smtpFromName) => onChange({ smtpFromName })} />
        <label className="block">
          <span className={LABEL}>Mot de passe</span>
          {/*
            Jamais de champ de saisie : le secret vit dans l'environnement,
            pas en base (jalon 32). On dit seulement quelle variable poser, et
            si elle est posée.
          */}
          <span className="block rounded-control border border-dashed border-line px-2.5 py-1.5 font-mono text-[12px]">
            {box.passwordEnv}{" "}
            <span className={box.passwordSet ? "text-win-d" : "text-danger"}>
              {box.passwordSet ? "· définie" : "· NON définie"}
            </span>
          </span>
        </label>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field label="Hôte IMAP" value={box.imapHost} placeholder="imap.ionos.fr" onChange={(imapHost) => onChange({ imapHost })} />
        <div className="grid grid-cols-2 gap-2.5">
          <label className="block">
            <span className={LABEL}>Port IMAP</span>
            <input
              type="number"
              value={box.imapPort}
              onChange={(event) => onChange({ imapPort: Number(event.target.value) })}
              className={CONTROL}
            />
          </label>
          <Field label="Dossier « Envoyés » (repli)" value={box.imapSentMailbox} placeholder="cherché par drapeau" onChange={(imapSentMailbox) => onChange({ imapSentMailbox })} />
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field label="Signature — nom" value={box.signName} placeholder="Mohamed Targani" onChange={(signName) => onChange({ signName })} />
        <Field label="Signature — titre" value={box.signTitle} placeholder="Co-Fondateur, Aura Flow AI" onChange={(signTitle) => onChange({ signTitle })} />
      </div>

      <div className="flex flex-wrap gap-4 text-[13px]">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={box.imapCopyEnabled}
            onChange={(event) => onChange({ imapCopyEnabled: event.target.checked })}
          />
          Copier chaque envoi dans « Envoyés »
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={box.active}
            onChange={(event) => onChange({ active: event.target.checked })}
          />
          Boîte active
        </label>
      </div>
    </div>
  );
}
