"use client";

import { useEffect, useRef, useState } from "react";
import { Drawer } from "@/components/ui/drawer";

import { Tabs, TabPanel, type TabDefinition } from "@/components/ui/tabs";
import type { ContactRecord } from "@/lib/api/contacts";
import { deleteContact } from "@/lib/client/crm-api";

import { RecordPanel, type Panel } from "@/components/activities/record-panel";
import type { SequenceOption } from "@/components/activities/run-sequence";
import type { Alert } from "@/lib/domain/types";
import { ContactForm, type ContactFormOptions } from "./contact-form";
import { ContactFields } from "./contact-fields";
import { ContactHeader } from "./contact-header";
import { ComposePanel } from "@/components/emails/compose-panel";
import { ContactEmails } from "@/components/emails/contact-emails";
import { SentToast, type SentNotice } from "@/components/emails/sent-toast";
import type { LinkableDeal } from "./link-deal";
import { FollowUpTab } from "./contact-followup-tab";
import { Notices } from "./drawer-notices";
import { QualifyFlow, type QualifyTarget } from "./qualify-flow";
import { entersQualified, outcomeQualifies, QUALIFIED } from "@/lib/domain/qualification";
import { toLifecycle } from "@/lib/domain/guards";

/**
 * La fiche contact : en-tête fixe, puis trois onglets.
 *
 * Le défaut réparé ici est un défaut de hiérarchie, pas de contenu : tout était
 * présent, dans une seule colonne, et la seule chose dont on a besoin avant un
 * appel — le numéro et ce qui a été dit — se trouvait tout en bas.
 *
 * **L'onglet par défaut suit l'état de la fiche.** Avec des interactions, on
 * arrive sur l'historique ; sans, sur les champs. Avant d'appeler on veut
 * savoir ce qui s'est dit, pas relire l'adresse — et sur une fiche qui n'a rien
 * à raconter, l'historique vide serait un cul-de-sac.
 */
type TabKey = "fiche" | "historique" | "suivi";

interface ContactDrawerProps extends ContactFormOptions {
  readonly contact: ContactRecord | null;
  readonly linkableDeals: readonly LinkableDeal[];
  readonly sequences: readonly SequenceOption[];
  readonly alerts: readonly Alert[];
  /** Statuts déjà employés ailleurs, proposés avant la liste de départ. */
  readonly statusSuggestions?: readonly string[];
  /** Offres proposées à la qualification, et celle vendue en dernier. */
  readonly offers?: readonly string[];
  readonly defaultOffer?: string;
  readonly onClose: () => void;
  readonly onChanged: () => void;
}

export function ContactDrawer({
  contact,
  linkableDeals,
  sequences,
  alerts,
  statusSuggestions = [],
  offers = [],
  defaultOffer = "",
  onClose,
  onChanged,
  ...options
}: ContactDrawerProps) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = contact?.id ?? null;
  const hasHistory = (contact?.activityCount ?? 0) > 0;

  // Choisi au premier rendu, pas dans un effet : un effet ne s'exécute pas au
  // rendu serveur, et l'onglet correct n'apparaîtrait qu'après hydratation.
  const [tab, setTab] = useState<TabKey>(() => (hasHistory ? "historique" : "fiche"));
  const [panel, setPanel] = useState<Panel>("none");
  const [qualifying, setQualifying] = useState<QualifyTarget | null>(null);
  /** Panneau de rédaction ouvert, et l'échange auquel le message se réfère. */
  const [composing, setComposing] = useState<{ activityId: string | undefined } | null>(null);
  const [sentNotice, setSentNotice] = useState<SentNotice | null>(null);

  /**
   * L'onglet ne se recalcule qu'au **changement de fiche**.
   *
   * Le lier à « la fiche a-t-elle un historique » déplacerait l'utilisateur
   * sous ses propres yeux : consigner le premier échange depuis l'onglet Fiche
   * ferait passer `hasHistory` de faux à vrai, et l'écran sauterait ailleurs au
   * moment précis où il vient d'agir.
   */
  const shown = useRef(id);
  useEffect(() => {
    if (id === null || id === shown.current) return;
    shown.current = id;
    setTab(hasHistory ? "historique" : "fiche");
    setPanel("none");
    setEditing(false);
    setConfirming(false);
  }, [id, hasHistory]);

  if (contact === null) return null;

  const openValue = contact.deals
    .filter((deal) => deal.status === "open")
    .reduce((total, deal) => total + deal.amount, 0);
  const wonValue = contact.deals
    .filter((deal) => deal.status === "won")
    .reduce((total, deal) => total + deal.amount, 0);

  const remove = async () => {
    setBusy(true);
    setError(null);
    const result = await deleteContact(contact.id);
    setBusy(false);
    if (result.ok) onChanged();
    else setError(result.message);
  };

  const tabs: readonly TabDefinition<TabKey>[] = [
    { key: "fiche", label: "Fiche" },
    { key: "historique", label: "Historique", count: contact.activityCount },
    { key: "suivi", label: "Suivi", count: contact.deals.length },
  ];

  return (
    <Drawer
      open
      onClose={onClose}
      title={`${contact.firstName} ${contact.lastName}`}
      subtitle={contact.company?.name ?? "Sans société"}
      banner={
        editing ? undefined : (
          <>
            <ContactHeader
              contact={contact}
              onLog={() => {
                setTab("historique");
                setPanel("log");
              }}
              // Écrire sans consigner d'abord : le brouillon part alors du seul
              // historique, sans échange désigné.
              onCompose={() => setComposing({ activityId: undefined })}
              onQualify={
                contact.lifecycle === QUALIFIED
                  ? undefined
                  : () =>
                      setQualifying({
                        id: contact.id,
                        name: `${contact.firstName} ${contact.lastName}`.trim(),
                      })
              }
            />
            <div className="px-[22px]">
              <Tabs tabs={tabs} active={tab} onSelect={setTab} idPrefix="contact" />
            </div>
          </>
        )
      }
      footer={
        editing ? undefined : (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-control bg-ink px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-ink-3"
            >
              Modifier
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => (confirming ? void remove() : setConfirming(true))}
              className="ml-auto rounded-control border border-[#F0C9C2] px-4 py-2 text-[13px] font-semibold text-[#B2311F] transition-colors hover:bg-pulse-l disabled:opacity-50"
            >
              {confirming ? "Confirmer la suppression" : "Supprimer"}
            </button>
          </>
        )
      }
    >
      {editing ? (
        <ContactForm
          {...options}
          contact={contact}
          onCancel={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            onChanged();
            // Le formulaire ne connaît pas les affaires : c'est la fiche qui
            // reconnaît l'entrée dans « Qualifié » et ouvre la modale.
            if (entersQualified(contact.lifecycle, toLifecycle(saved))) {
              setQualifying({
                id: contact.id,
                name: `${contact.firstName} ${contact.lastName}`.trim(),
              });
            }
          }}
        />
      ) : (
        <>
          <Notices confirming={confirming} error={error} />

          <TabPanel tabKey="fiche" active={tab} idPrefix="contact">
            <ContactFields contact={contact} />
          </TabPanel>

          <TabPanel tabKey="suivi" active={tab} idPrefix="contact">
            <FollowUpTab
              deals={contact.deals}
              contactId={contact.id}
              linkableDeals={linkableDeals}
              onChanged={onChanged}
            />
          </TabPanel>

          {/*
            Un seul `RecordPanel`, monté en permanence, dont la moitié rendue
            suit l'onglet. Deux instances — une par onglet — rechargeraient la
            chronologie et les tâches à chaque va-et-vient, pour afficher
            exactement les mêmes lignes.
          */}
          <div className={tab === "fiche" ? "hidden" : ""}>
            {tab === "historique" && <ContactEmails contactId={contact.id} />}
            <RecordPanel
              link={{ contactId: contact.id }}
              owners={options.owners}
              defaultOwner={contact.owner === "" ? (options.owners[0] ?? "") : contact.owner}
              sequences={sequences}
              alerts={alerts}
              currentReminder={contact.nextReminder}
              currentStatus={contact.status}
              statusSuggestions={statusSuggestions}
              section={tab === "historique" ? "history" : "followup"}
              panel={panel}
              onPanelChange={setPanel}
              onOutcome={(outcome) => {
                if (contact.lifecycle !== QUALIFIED && outcomeQualifies(outcome)) {
                  setQualifying({
                    id: contact.id,
                    name: `${contact.firstName} ${contact.lastName}`.trim(),
                  });
                }
              }}
              onCompose={(activityId) => setComposing({ activityId })}
              onChanged={onChanged}
            />
          </div>
        </>
      )}

      <ComposePanel
        open={composing !== null}
        contactId={composing === null ? null : contact.id}
        fromActivityId={composing?.activityId}
        onClose={() => setComposing(null)}
        onSent={(sent) => {
          setComposing(null);
          setSentNotice(sent);
          onChanged();
        }}
      />

      <SentToast
        sent={sentNotice}
        contactId={contact.id}
        onDismiss={() => setSentNotice(null)}
        onChanged={onChanged}
      />

      <QualifyFlow
        target={qualifying}
        offers={offers}
        defaultOffer={defaultOffer}
        onClose={() => setQualifying(null)}
        onChanged={onChanged}
      />
    </Drawer>
  );
}
