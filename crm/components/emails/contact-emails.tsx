"use client";

import { useEffect, useState } from "react";
import { requestJson } from "@/lib/client/http";
import { formatDate } from "@/lib/format";

/**
 * Les emails envoyés à une fiche, dans son onglet Historique.
 *
 * **Un bloc distinct de la chronologie, et non une ligne de plus dedans.** La
 * chronologie répond à « que s'est-il passé ? » et mêle appels, notes et
 * corrections ; ce bloc répond à « combien de fois lui ai-je écrit, et
 * quand ? », qui est la question qu'on se pose avant d'écrire une fois de plus.
 *
 * L'état de la copie « Envoyés » s'affiche ici parce que c'est le seul endroit
 * où l'on regarde un envoi précis. Un échec de copie n'a jamais empêché l'envoi
 * — le message est parti — et le dire à côté du message concerné évite qu'on le
 * confonde avec un échec d'envoi.
 */

interface ContactEmail {
  readonly id: string;
  readonly sentAt: string;
  readonly subject: string;
  readonly signatoryName: string;
  readonly tracked: boolean;
  readonly firstOpenAt: string | null;
  readonly openCount: number;
  readonly copyStatus: string;
  readonly copyError: string;
}

function isPayload(value: unknown): value is { emails: ContactEmail[] } {
  return typeof value === "object" && value !== null && "emails" in value;
}

export function ContactEmails({ contactId }: { readonly contactId: string }) {
  const [emails, setEmails] = useState<readonly ContactEmail[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void requestJson(`/api/contacts/${contactId}/emails`, {}, isPayload).then((result) => {
      if (cancelled) return;
      // Un échec de lecture laisse le bloc vide plutôt que d'afficher zéro :
      // « aucun email » et « je n'ai pas pu lire » ne sont pas la même chose.
      setEmails(result.ok ? result.data.emails : null);
    });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  if (emails === null || emails.length === 0) return null;

  const last = emails[0];

  return (
    <section className="mb-4 rounded-card border border-line bg-surface px-3.5 py-3">
      <h3 className="font-display text-[13px] font-semibold">
        {emails.length} email{emails.length > 1 ? "s" : ""} envoyé
        {emails.length > 1 ? "s" : ""}
        {last !== undefined && (
          <span className="font-sans font-normal text-muted">
            {" "}
            · dernier le {formatDate(new Date(last.sentAt))}
          </span>
        )}
      </h3>

      <ul className="mt-2 space-y-1.5">
        {emails.map((email) => (
          <li key={email.id} className="border-t border-line-2 pt-1.5 first:border-0 first:pt-0">
            <p className="text-[12.5px]">
              <span className="font-medium">{email.subject}</span>
              <span className="text-muted">
                {" "}
                · {formatDate(new Date(email.sentAt))}
                {email.signatoryName !== "" && ` · ${email.signatoryName}`}
              </span>
            </p>
            <p className="text-[11.5px] text-muted">
              {email.tracked
                ? email.firstOpenAt === null
                  ? "Aucune ouverture détectée"
                  : `Ouvert le ${formatDate(new Date(email.firstOpenAt))} (${email.openCount} chargement${email.openCount > 1 ? "s" : ""} du pixel — estimation)`
                : "Suivi d'ouverture désactivé pour cet envoi"}
              {email.copyStatus === "failed" && (
                <span className="text-[#9A6410]">
                  {" "}
                  · non copié dans « Envoyés » : {email.copyError}
                </span>
              )}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
