"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";

/**
 * Messagerie sortante : la configuration, et l'essai d'envoi.
 *
 * **Le mot de passe n'apparaît nulle part.** Il n'est ni saisi ici, ni stocké en
 * base, ni renvoyé par l'API : il vit dans une variable d'environnement du
 * service, comme la clé Anthropic. Le panneau dit seulement s'il est **défini**.
 * Un champ de saisie aurait été plus commode et aurait mis un mot de passe de
 * messagerie dans la base, donc dans chaque sauvegarde JSON téléchargée.
 *
 * Le bouton d'essai suit la leçon du jalon 16 : il ne dit pas « échec », il dit
 * **ce que le serveur SMTP a répondu**. C'est la différence entre corriger un
 * port et ouvrir un ticket.
 */
export interface MailStatus {
  host: string;
  port: number;
  encryption: "tls" | "starttls";
  user: string;
  from: string;
  fromName: string;
  passwordSet: boolean;
  ready: boolean;
  missing: readonly string[];
  /** Signature des brouillons — l'associé signe la sienne. */
  signName: string;
  signTitle: string;
  /** Lien de démonstration. URL vide = Alex supprime la phrase entière. */
  demoLabel: string;
  demoUrl: string;
}

function isPayload(value: unknown): value is { mail: MailStatus; passwordEnv: string } {
  return typeof value === "object" && value !== null && "mail" in value;
}

function isSent(value: unknown): value is { sentTo: string } {
  return typeof value === "object" && value !== null && "sentTo" in value;
}

const FIELD =
  "w-full rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] focus:border-brand focus:outline-none";
const LABEL = "block text-[12px] font-semibold text-muted";
const BUTTON =
  "rounded-control px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-50";

export function MailPanel({
  initial,
  passwordEnv,
}: {
  initial: MailStatus;
  passwordEnv: string;
}) {
  const [mail, setMail] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const set = <K extends keyof MailStatus>(key: K, value: MailStatus[K]) =>
    setMail((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    const result = await requestJson(
      "/api/mail",
      {
        method: "PATCH",
        body: JSON.stringify({
          host: mail.host,
          port: mail.port,
          encryption: mail.encryption,
          user: mail.user,
          from: mail.from,
          fromName: mail.fromName,
          signName: mail.signName,
          signTitle: mail.signTitle,
          demoLabel: mail.demoLabel,
          demoUrl: mail.demoUrl,
        }),
      },
      isPayload,
    );
    setBusy(false);
    if (result.ok) {
      setMail(result.data.mail);
      setDone("Configuration enregistrée.");
    } else setError(result.message);
  };

  const test = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    const result = await requestJson("/api/mail", { method: "POST" }, isSent);
    setBusy(false);
    if (result.ok) setDone(`Message d'essai envoyé à ${result.data.sentTo}. Vérifiez la boîte.`);
    else setError(result.message);
  };

  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card">
      <h3 className="font-display text-[15px] font-semibold">Messagerie</h3>
      <p className="mt-1 text-[12.5px] text-muted">
        Envoi uniquement, par SMTP. <b className="font-semibold text-ink">Les réponses de vos
        destinataires n'arrivent pas dans le CRM</b> — elles vont dans votre boîte habituelle.
        La réception n'est pas gérée par cette version.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label>
          <span className={LABEL}>Hôte SMTP</span>
          <input
            className={FIELD}
            value={mail.host}
            placeholder="smtp.ionos.fr"
            onChange={(event) => set("host", event.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className={LABEL}>Port</span>
            <input
              className={FIELD}
              type="number"
              value={mail.port}
              onChange={(event) => set("port", Number(event.target.value))}
            />
          </label>
          <label>
            <span className={LABEL}>Chiffrement</span>
            <select
              className={FIELD}
              value={mail.encryption}
              onChange={(event) =>
                set("encryption", event.target.value === "tls" ? "tls" : "starttls")
              }
            >
              <option value="starttls">STARTTLS (587)</option>
              <option value="tls">TLS direct (465)</option>
            </select>
          </label>
        </div>
        <label>
          <span className={LABEL}>Identifiant</span>
          <input
            className={FIELD}
            value={mail.user}
            placeholder="vous@votredomaine.fr"
            onChange={(event) => set("user", event.target.value)}
          />
        </label>
        <label>
          <span className={LABEL}>Adresse d'expédition</span>
          <input
            className={FIELD}
            value={mail.from}
            placeholder="vous@votredomaine.fr"
            onChange={(event) => set("from", event.target.value)}
          />
        </label>
        <label className="sm:col-span-2">
          <span className={LABEL}>Nom affiché</span>
          <input
            className={FIELD}
            value={mail.fromName}
            placeholder="Yanis Tidahy"
            onChange={(event) => set("fromName", event.target.value)}
          />
          <span className="mt-1 block text-[11.5px] text-muted">
            Ce que le destinataire voit à la place de l'adresse.
          </span>
        </label>
      </div>

      {/*
        Signature et lien : de la donnée, pas du code. Le jalon 33 avait figé
        « L'équipe AuraFLOW AI » dans un fichier de prompt — une valeur écrite en
        dur qui contredit l'écran le jour où on la change.
      */}
      <div className="mt-4 border-t border-line pt-3">
        <h4 className="text-[13px] font-semibold">Signature des brouillons</h4>
        <p className="mt-0.5 text-[11.5px] text-muted">
          Les deux dernières lignes de chaque email rédigé par Alex.
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label>
            <span className={LABEL}>Nom</span>
            <input
              className={FIELD}
              value={mail.signName}
              placeholder="Yanis Tidahy"
              onChange={(event) => set("signName", event.target.value)}
            />
          </label>
          <label>
            <span className={LABEL}>Titre</span>
            <input
              className={FIELD}
              value={mail.signTitle}
              placeholder="Fondateur, Aura Flow AI"
              onChange={(event) => set("signTitle", event.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <h4 className="text-[13px] font-semibold">Lien de démonstration</h4>
        <p className="mt-0.5 text-[11.5px] text-muted">
          Le libellé devient un lien cliquable dans le message ; l'adresse reste visible dans la
          version texte. <b className="font-semibold text-ink">Laissez l'adresse vide et Alex
          supprimera la phrase</b> plutôt que d'inventer un lien.
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label>
            <span className={LABEL}>Libellé du lien</span>
            <input
              className={FIELD}
              value={mail.demoLabel}
              placeholder="Diagnostic offert"
              onChange={(event) => set("demoLabel", event.target.value)}
            />
          </label>
          <label>
            <span className={LABEL}>URL du lien</span>
            <input
              className={FIELD}
              value={mail.demoUrl}
              placeholder="https://…"
              onChange={(event) => set("demoUrl", event.target.value)}
            />
          </label>
        </div>
      </div>

      {/* Le mot de passe : un état, jamais une valeur. */}
      <div className="mt-3 rounded-control border border-line bg-surface-2 px-3 py-2.5">
        <span className={LABEL}>Mot de passe</span>
        <p className="mt-0.5 text-[12.5px]">
          {mail.passwordSet ? (
            <span className="font-semibold text-win-d">
              ✓ Défini dans la variable {passwordEnv} du service.
            </span>
          ) : (
            <span className="font-semibold text-[#B2311F]">
              ✗ Absent. Ajoutez {passwordEnv} aux variables du service Railway, puis redéployez.
            </span>
          )}
        </p>
        <p className="mt-1 text-[11.5px] text-muted">
          Il n'est jamais enregistré en base ni renvoyé au navigateur — même règle que la clé
          Anthropic. Cet écran sait seulement s'il existe.
        </p>
      </div>

      {!mail.ready && mail.missing.length > 0 && (
        <p className="mt-2 rounded-control border border-[#F3E0BC] bg-gold-l px-3 py-2 text-[12.5px] text-[#9A6410]">
          Envoi impossible : il manque {mail.missing.join(", ")}.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className={`${BUTTON} bg-brand text-white hover:bg-brand-d`}
        >
          Enregistrer
        </button>
        <button
          type="button"
          disabled={busy || !mail.ready}
          onClick={() => void test()}
          className={`${BUTTON} border border-line bg-surface hover:bg-surface-2`}
        >
          {busy ? "Envoi…" : "Tester l'envoi"}
        </button>
        <span className="text-[12px] text-muted">
          L'essai envoie un vrai message à {mail.from || "votre adresse d'expédition"}.
        </span>
      </div>

      {error !== null && (
        <p className="mt-2 rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] whitespace-pre-wrap text-[#B2311F]">
          {error}
        </p>
      )}
      {done !== null && <p className="mt-2 text-[12.5px] text-win-d">{done}</p>}
    </section>
  );
}
