"use client";

import { useEffect, useRef, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Eyebrow, StatusTag } from "@/components/ui/primitives";
import { Tabs, TabPanel, type TabDefinition } from "@/components/ui/tabs";
import type { ContactRecord } from "@/lib/api/contacts";
import { deleteContact } from "@/lib/client/crm-api";
import { money } from "@/lib/format";
import { RecordPanel, type Panel } from "@/components/activities/record-panel";
import type { SequenceOption } from "@/components/activities/run-sequence";
import type { Alert } from "@/lib/domain/types";
import { ContactForm, type ContactFormOptions } from "./contact-form";
import { ContactFields } from "./contact-fields";
import { ContactHeader } from "./contact-header";
import { LinkDeal, type LinkableDeal } from "./link-deal";

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
  readonly onClose: () => void;
  readonly onChanged: () => void;
}

export function ContactDrawer({
  contact,
  linkableDeals,
  sequences,
  alerts,
  statusSuggestions = [],
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
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      ) : (
        <>
          {confirming && (
            <p className="mb-4 rounded-control border border-[#F0C9C2] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
              Les affaires et interactions liées seront conservées, mais détachées. Les tâches de
              ce contact seront supprimées. Cliquez à nouveau sur « Supprimer » pour confirmer.
            </p>
          )}
          {error !== null && (
            <p className="mb-3 rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
              {error}
            </p>
          )}

          <TabPanel tabKey="fiche" active={tab} idPrefix="contact">
            <ContactFields contact={contact} />
          </TabPanel>

          <TabPanel tabKey="suivi" active={tab} idPrefix="contact">
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Figure label="Pipeline ouvert" value={money(openValue)} />
              <Figure label="CA signé" value={money(wonValue)} />
            </div>

            <h3 className="mt-5 mb-2.5 font-display text-sm font-semibold">
              Affaires liées ({contact.deals.length})
            </h3>
            {contact.deals.length === 0 ? (
              <p className="rounded-card border border-dashed border-line px-3.5 py-4 text-[12.5px] text-muted">
                Aucune affaire rattachée à ce contact.
              </p>
            ) : (
              <ul className="grid gap-1.5">
                {contact.deals.map((deal) => (
                  <li
                    key={deal.id}
                    className="flex flex-wrap items-center gap-2 rounded-card border border-line px-3 py-2 text-[13px]"
                  >
                    <span className="font-semibold">{deal.name}</span>
                    <span
                      className="rounded-full px-2 py-[2px] text-[11px] font-semibold"
                      style={{ backgroundColor: `${deal.stage.color}1f`, color: deal.stage.color }}
                    >
                      {deal.stage.name}
                    </span>
                    {deal.status !== "open" && <StatusTag status={deal.status} />}
                    <span className="ml-auto font-mono font-semibold tabular-nums">
                      {money(deal.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <LinkDeal contactId={contact.id} deals={linkableDeals} onChanged={onChanged} />
          </TabPanel>

          {/*
            Un seul `RecordPanel`, monté en permanence, dont la moitié rendue
            suit l'onglet. Deux instances — une par onglet — rechargeraient la
            chronologie et les tâches à chaque va-et-vient, pour afficher
            exactement les mêmes lignes.
          */}
          <div className={tab === "fiche" ? "hidden" : ""}>
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
              onChanged={onChanged}
            />
          </div>
        </>
      )}
    </Drawer>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-surface-2 px-4 py-3">
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-1.5 font-display text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
