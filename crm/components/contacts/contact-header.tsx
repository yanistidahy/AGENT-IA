"use client";

import { ContactStatusTag, LifecycleTag } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import type { ContactRecord } from "@/lib/api/contacts";
import { formatDate } from "@/lib/format";
import { describeReminder } from "@/lib/domain/follow-up";
import { externalUrl } from "@/lib/domain/links";
import { ACTIVITY_LABELS } from "@/lib/domain/types";
import { isOutcome, OUTCOME_LABELS } from "@/lib/domain/status";
import { isTerminal } from "@/lib/domain/lost";

/**
 * L'en-tête fixe de la fiche contact.
 *
 * Ce qui manquait : ouvrir une fiche montrait tout, donc rien. Le numéro à
 * composer et ce qui a été dit se trouvaient sous une colonne de champs qu'on
 * ne lit jamais avant un appel.
 *
 * Cinq choses ici, et pas une de plus — celles dont on a besoin **pour agir** :
 * qui, où, dans quel état, quand est la prochaine échéance, et le numéro. Plus
 * l'action primaire. Tout le reste passe sous les onglets.
 */
export function ContactHeader({
  contact,
  onLog,
  onQualify,
}: {
  contact: ContactRecord;
  onLog: () => void;
  /** Absent quand la fiche est déjà qualifiée : il n'y a plus rien à proposer. */
  onQualify?: () => void;
}) {
  const phone = contact.phone.trim();
  // Un cycle de vie terminal supprime tout le mobilier de relance : pastille de
  // statut, échéance, et le « jamais contacté » du coin droit. Une fiche perdue
  // n'attend rien — quatre affirmations sur la même ligne dont trois parlaient
  // d'attente, c'était le défaut signalé.
  const terminal = isTerminal(contact.lifecycle);
  const websiteHref = externalUrl(contact.website);
  const linkedinHref = externalUrl(contact.linkedin);
  const reminder =
    contact.nextReminder === null ? null : describeReminder(contact.nextReminder, new Date());

  return (
    <div className="border-b border-line bg-surface-2 px-[22px] py-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Sur une fiche close, la pastille de statut porte déjà « Perdu » : la
            doubler d'une pastille de cycle de vie identique, côte à côte, dit
            deux fois la même chose. C'est la colonne Statut qui la garde — c'est
            là qu'on regarde. Le motif de perte reste affiché juste après. */}
        {!terminal && <LifecycleTag lifecycle={contact.lifecycle} />}
        <ContactStatusTag
          status={contact.status}
          followUp={contact.followUp}
          lifecycle={contact.lifecycle}
        />
        {!terminal && reminder !== null && (
          <span
            className={`inline-flex items-center rounded-full px-2 py-[3px] text-[11.5px] font-semibold ${
              reminder.urgency === "future" ? "bg-paper text-muted" : "bg-pulse-l text-[#B2311F]"
            }`}
          >
            Relance {reminder.label}
          </span>
        )}
        {!terminal && contact.nextReminder === null && (
          <span className="text-[11.5px] text-muted">Aucune relance programmée</span>
        )}
        {terminal && contact.lostReason !== "" && (
          <span className="text-[11.5px] text-muted">{contact.lostReason}</span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {phone === "" ? (
          <span className="rounded-control border border-dashed border-line px-2.5 py-1.5 text-[12px] text-muted">
            Pas de téléphone
          </span>
        ) : (
          // Le geste le plus fréquent avant tout le reste : sur mobile c'est un
          // appel, sur poste fixe c'est au moins un numéro qu'on ne retape pas.
          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            className="inline-flex items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 py-1.5 font-mono text-[12.5px] font-semibold text-brand-d transition-colors hover:bg-paper"
          >
            {phone}
          </a>
        )}

        {/*
          Ouvrir le site ou le profil LinkedIn en un clic, sans passer par
          l'onglet Fiche : c'est le geste d'avant-appel, au même endroit que le
          numéro. Grisés plutôt qu'absents quand la valeur manque — un bouton
          qui disparaît selon les fiches se cherche, un bouton désactivé se lit
          d'un coup d'œil.
        */}
        <HeaderLink href={websiteHref} icon="globe" label="Ouvrir le site" />
        <HeaderLink href={linkedinHref} icon="linkedin" label="Ouvrir le profil LinkedIn" />

        <button
          type="button"
          onClick={onLog}
          className="rounded-control bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-d"
        >
          Consigner un échange
        </button>

        {onQualify !== undefined && (
          <button
            type="button"
            onClick={onQualify}
            title="Le prospect a exprimé le désir de l'offre — une affaire sera ouverte."
            className="rounded-control border border-[#F0DFB8] bg-gold-l px-3 py-1.5 text-[12.5px] font-semibold text-[#9A6410] transition-colors hover:bg-gold-l/70"
          >
            Qualifier
          </button>
        )}

        <span className="ml-auto text-[11.5px] text-muted">
          {contact.lastContact !== null
            ? `dernier contact ${formatDate(contact.lastContact)}`
            : terminal
              ? ""
              : "jamais contacté"}
        </span>
      </div>

      {/*
        L'effort fourni, et à qui l'on parle. Ces cinq faits répondent aux
        questions qu'on se pose la main sur le combiné : ai-je déjà essayé,
        combien de fois, par quel canal, est-ce une grosse maison, et depuis
        quand cette fiche dort-elle. Aucun ne demandait d'ouvrir un autre
        écran — ils demandaient seulement d'être calculés.
      */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted">
        <span>
          <b className="font-mono font-semibold text-ink tabular-nums">{contact.attempts}</b>{" "}
          tentative(s) ·{" "}
          <b
            className={`font-mono font-semibold tabular-nums ${
              contact.attempts > 0 && contact.unanswered === contact.attempts
                ? "text-[#B2311F]"
                : "text-ink"
            }`}
          >
            {contact.attempts - contact.unanswered}
          </b>{" "}
          réponse(s)
        </span>

        {contact.lastChannel !== null && (
          <span>
            dernier échange : {ACTIVITY_LABELS[contact.lastChannel]}
            {contact.lastOutcome !== "" && isOutcome(contact.lastOutcome)
              ? ` — ${OUTCOME_LABELS[contact.lastOutcome]}`
              : ""}
          </span>
        )}

        {(contact.companySize !== "" || contact.companyIndustry !== "") && (
          <span>
            {[contact.companyIndustry, contact.companySize].filter((v) => v !== "").join(" · ")}
          </span>
        )}

        <span>dans le vivier depuis {contact.ageDays} j</span>
      </div>
    </div>
  );
}

function HeaderLink({
  href,
  icon,
  label,
}: {
  href: string | null;
  icon: "globe" | "linkedin";
  label: string;
}) {
  if (href === null) {
    return (
      <span
        aria-hidden
        title={`${label} — valeur manquante`}
        className="inline-flex items-center rounded-control border border-dashed border-line p-1.5 text-muted"
      >
        <Icon name={icon} size={15} />
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={label}
      className="inline-flex items-center rounded-control border border-line bg-surface p-1.5 text-muted transition-colors hover:border-brand hover:text-brand-d"
    >
      <Icon name={icon} size={15} />
    </a>
  );
}
