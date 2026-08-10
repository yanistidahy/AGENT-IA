"use client";

import { ContactStatusTag, LifecycleTag } from "@/components/ui/primitives";
import type { ContactRecord } from "@/lib/api/contacts";
import { formatDate } from "@/lib/format";
import { describeReminder } from "@/lib/domain/follow-up";

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
}: {
  contact: ContactRecord;
  onLog: () => void;
}) {
  const phone = contact.phone.trim();
  const reminder =
    contact.nextReminder === null ? null : describeReminder(contact.nextReminder, new Date());

  return (
    <div className="border-b border-line bg-surface-2 px-[22px] py-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <LifecycleTag lifecycle={contact.lifecycle} />
        <ContactStatusTag status={contact.status} followUp={contact.followUp} />
        {reminder !== null && (
          <span
            className={`inline-flex items-center rounded-full px-2 py-[3px] text-[11.5px] font-semibold ${
              reminder.urgency === "future" ? "bg-paper text-muted" : "bg-pulse-l text-[#B2311F]"
            }`}
          >
            Relance {reminder.label}
          </span>
        )}
        {contact.nextReminder === null && (
          <span className="text-[11.5px] text-muted">Aucune relance programmée</span>
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
            className="inline-flex items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 py-1.5 font-mono text-[12.5px] font-semibold text-flux-d transition-colors hover:bg-paper"
          >
            {phone}
          </a>
        )}

        <button
          type="button"
          onClick={onLog}
          className="rounded-control bg-flux px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-flux-d"
        >
          Consigner un échange
        </button>

        <span className="ml-auto text-[11.5px] text-muted">
          {contact.lastContact === null
            ? "jamais contacté"
            : `dernier contact ${formatDate(contact.lastContact)}`}
        </span>
      </div>
    </div>
  );
}
