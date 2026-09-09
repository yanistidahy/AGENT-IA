"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import { MailboxFields, type MailboxDraft } from "./mailbox-fields";

/**
 * Les boîtes d'envoi — la configuration unique du jalon 32, devenue liste.
 *
 * Chaque boîte porte son SMTP, son IMAP et **sa signature** : choisir la boîte
 * au moment d'écrire choisit qui signe, et c'est ce qui remplace le sélecteur
 * de signataires du jalon 35.
 *
 * Les deux essais sont **par boîte**, et leur réponse la nomme : à trois
 * boîtes, « échec de l'envoi » sans dire laquelle ferait vérifier les deux
 * mauvaises d'abord. Le mot de passe ne se saisit jamais ici — la variable à
 * poser sur Railway est affichée à côté de son état.
 */

function isPayload(value: unknown): value is { mailboxes: MailboxDraft[] } {
  return typeof value === "object" && value !== null && "mailboxes" in value;
}

function isSent(value: unknown): value is { sentTo: string; mailboxLabel: string } {
  return typeof value === "object" && value !== null && "sentTo" in value;
}

function isCopied(value: unknown): value is { mailbox: string; bySpecialUse: boolean } {
  return typeof value === "object" && value !== null && "bySpecialUse" in value;
}

const NEW_BOX: Omit<MailboxDraft, "id"> = {
  slug: "",
  label: "",
  active: true,
  smtpHost: "smtp.ionos.fr",
  smtpPort: 587,
  smtpEncryption: "starttls",
  smtpUser: "",
  smtpFrom: "",
  smtpFromName: "",
  imapHost: "imap.ionos.fr",
  imapPort: 993,
  imapSentMailbox: "",
  imapCopyEnabled: true,
  signName: "",
  signTitle: "",
  passwordEnv: "(attribuée à l'enregistrement, d'après le libellé)",
  passwordSet: false,
};

export function MailboxesPanel({ initial }: { readonly initial: readonly MailboxDraft[] }) {
  const [boxes, setBoxes] = useState<MailboxDraft[]>([...initial]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const patch = (index: number, change: Partial<MailboxDraft>) => {
    setNotice(null);
    setBoxes((current) =>
      current.map((box, at) => (at === index ? { ...box, ...change } : box)),
    );
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await requestJson(
      "/api/mail",
      {
        method: "PUT",
        body: JSON.stringify({
          mailboxes: boxes.map(({ slug: _slug, passwordEnv: _env, passwordSet: _set, ...box }) => box),
        }),
      },
      isPayload,
    );
    setBusy(false);
    if (result.ok) {
      setBoxes([...result.data.mailboxes]);
      setNotice("Boîtes enregistrées.");
    } else {
      setError(result.message);
    }
  };

  const testSend = async (box: MailboxDraft) => {
    if (box.id === undefined) {
      setError("Enregistrez d'abord la boîte : l'essai part de ce qui est en base.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await requestJson(
      "/api/mail",
      { method: "POST", body: JSON.stringify({ mailboxId: box.id }) },
      isSent,
    );
    setBusy(false);
    if (result.ok) {
      setNotice(`« ${result.data.mailboxLabel} » : message d'essai envoyé à ${result.data.sentTo}.`);
    } else {
      setError(result.message);
    }
  };

  const testCopy = async (box: MailboxDraft) => {
    if (box.id === undefined) {
      setError("Enregistrez d'abord la boîte : l'essai part de ce qui est en base.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await requestJson(
      "/api/mail/copy-test",
      { method: "POST", body: JSON.stringify({ mailboxId: box.id }) },
      isCopied,
    );
    setBusy(false);
    if (result.ok) {
      setNotice(
        `« ${box.label} » : essai déposé dans « ${result.data.mailbox} » — trouvé ` +
          (result.data.bySpecialUse ? "par son drapeau \\Sent." : "par le nom de repli."),
      );
    } else {
      setError(result.message);
    }
  };

  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card">
      <p className="mb-3 text-[12px] text-muted">
        Chaque boîte envoie sous sa propre adresse et signe de son propre nom. Le mot de passe
        se pose sur Railway dans la variable affichée — jamais ici, jamais en base. Le même
        secret sert au SMTP et à l'IMAP : c'est la même boîte.
      </p>

      <div className="space-y-3">
        {boxes.map((box, index) => (
          <article key={box.id ?? `new-${index}`} className="rounded-control border border-line-2 p-3">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <input
                value={box.label}
                placeholder="Libellé — « Boîte de Mohamed »"
                onChange={(event) => patch(index, { label: event.target.value })}
                className="min-w-[220px] flex-1 rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] font-semibold outline-none focus:border-brand"
              />
              {box.id !== undefined && (
                <span className="font-mono text-[11px] text-muted">slug : {box.slug}</span>
              )}
              <button
                type="button"
                onClick={() => {
                  setNotice(null);
                  setBoxes((current) => current.filter((_, at) => at !== index));
                }}
                className="min-h-[44px] text-[12px] text-muted hover:text-danger lg:min-h-0"
              >
                Retirer
              </button>
            </div>

            <MailboxFields box={box} onChange={(change) => patch(index, change)} />

            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void testSend(box)}
                disabled={busy}
                className="min-h-[44px] rounded-control border border-line px-3 text-[13px] hover:border-brand disabled:opacity-50 lg:min-h-0 lg:py-1.5"
              >
                Tester l'envoi
              </button>
              <button
                type="button"
                onClick={() => void testCopy(box)}
                disabled={busy}
                className="min-h-[44px] rounded-control border border-line px-3 text-[13px] hover:border-brand disabled:opacity-50 lg:min-h-0 lg:py-1.5"
              >
                Tester la copie
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setNotice(null);
            setBoxes((current) => [...current, { ...NEW_BOX }]);
          }}
          className="min-h-[44px] rounded-control border border-line px-3 text-[13px] hover:border-brand lg:min-h-0 lg:py-1.5"
        >
          Ajouter une boîte
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="min-h-[44px] rounded-control bg-brand px-3 text-[13px] font-medium text-white hover:bg-brand-d disabled:opacity-60 lg:min-h-0 lg:py-1.5"
        >
          {busy ? "…" : "Enregistrer les boîtes"}
        </button>
        {notice !== null && <span className="text-[12px] text-win-d">{notice}</span>}
        {error !== null && <span className="text-[12px] text-danger">{error}</span>}
      </div>
    </section>
  );
}
