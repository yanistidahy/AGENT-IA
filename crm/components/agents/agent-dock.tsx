"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentProfile } from "@/lib/api/agents";
import { useAgentChat } from "@/lib/client/use-agent-chat";
import { Composer } from "./composer";
import { Portrait } from "./portrait";
import { Thread } from "./thread";
import { Icon } from "@/components/ui/icon";

/**
 * L'agent en panneau latéral, par-dessus l'écran courant.
 *
 * **On travaille dans le CRM et on pose une question sur ce qu'on regarde.**
 * Renvoyer vers `/conseil` cassait ce geste : on perdait la liste filtrée, le
 * pipeline ou le tableau de bord qu'on avait sous les yeux, et il fallait
 * revenir puis refiltrer. Le panneau garde l'écran derrière lui.
 *
 * `/conseil` reste joignable pour la vue pleine largeur — historique complet,
 * roster, constats en attente. Ce panneau n'en est pas un remplacement mais une
 * seconde porte, et **les deux ouvrent sur le même fil** : `useAgentChat` est
 * partagé, les conversations sont les mêmes lignes en base.
 *
 * Le fil ouvert est **mémorisé par agent** le temps de la session : rouvrir le
 * panneau reprend où l'on s'était arrêté, ce qui est la différence entre un
 * assistant et une boîte de dialogue.
 */
const REMEMBERED = new Map<string, string>();

export function AgentDock({
  agent,
  open,
  onClose,
}: {
  readonly agent: AgentProfile | null;
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const [deep] = useState(false);
  const slug = agent?.slug ?? "";

  const chat = useAgentChat({
    agentId: slug,
    deep,
    onCreated: (created) => REMEMBERED.set(slug, created.id),
  });

  const close = useRef(onClose);
  close.current = onClose;

  const opener = useRef<HTMLElement | null>(null);
  const overlayDown = useRef(false);
  const restored = useRef<string | null>(null);

  /**
   * Reprendre le fil de cet agent à l'ouverture.
   *
   * La reprise n'a lieu qu'une fois par couple (agent, ouverture) : `restored`
   * empêche de recharger l'historique à chaque rendu du parent, ce qui
   * écraserait un message en cours de frappe.
   */
  useEffect(() => {
    if (!open || slug === "") {
      restored.current = null;
      return;
    }
    if (restored.current === slug) return;
    restored.current = slug;

    const remembered = REMEMBERED.get(slug);
    if (remembered !== undefined && remembered !== chat.activeId) {
      void chat.openConversation(remembered);
      return;
    }
    if (remembered === undefined) chat.reset();
  }, [open, slug, chat]);

  // Échap, blocage du défilement et retour du focus : mêmes règles que le
  // tiroir de fiche (jalon 28), pour que deux surfaces modales ne se comportent
  // pas différemment sous les mêmes gestes.
  useEffect(() => {
    if (!open) return;

    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener.current?.focus();
    };
  }, [open]);

  if (!open || agent === null) return null;

  return (
    <>
      {/*
        Le voile ne bloque pas le défilement de la page derrière : le sujet du
        panneau est justement ce qu'on regarde, et pouvoir faire défiler la
        liste tout en questionnant l'agent est la raison d'être de cet écran.
      */}
      <div
        className="fixed inset-0 z-40 bg-[rgba(13,18,32,0.28)]"
        onMouseDown={(event) => {
          overlayDown.current = event.target === event.currentTarget;
        }}
        onClick={(event) => {
          if (overlayDown.current && event.target === event.currentTarget) close.current();
          overlayDown.current = false;
        }}
        aria-hidden
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Conversation avec ${agent.name}`}
        className="bg-ink fixed inset-y-0 right-0 z-50 flex w-[min(480px,100vw)] flex-col shadow-float"
      >
        <header className="border-rail-3 flex flex-none items-center gap-2.5 border-b px-4 py-3">
          <Portrait
            agent={agent}
            size="thumb"
            className="size-9 shrink-0 rounded-full"
            initialsClassName="text-[12px]"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[14.5px] leading-tight font-semibold text-white">
              {agent.name}
            </p>
            <p className="text-rail-dim truncate text-[11.5px]">{agent.role}</p>
          </div>
          <a
            href="/conseil"
            title="Ouvrir la vue complète"
            className="text-rail-dim rounded-control p-1.5 transition-colors hover:bg-[#232B5C] hover:text-white"
          >
            <Icon name="expand" size={15} />
          </a>
          <button
            type="button"
            onClick={() => close.current()}
            aria-label="Fermer"
            className="text-rail-dim relative z-10 rounded-control p-1.5 transition-colors hover:bg-[#232B5C] hover:text-white"
          >
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <Thread
            items={chat.items}
            agent={agent}
            streaming={chat.streaming}
            error={chat.error}
            onDecide={(toolUseId, decision) => void chat.decide(toolUseId, decision)}
            onAsk={(question) => void chat.send(question)}
          />
        </div>

        <Composer
          agentName={agent.name}
          disabled={agent.locked}
          streaming={chat.streaming}
          deep={deep}
          onDeepChange={() => {
            /* Le mode approfondi reste à la vue complète : ici on pose une
               question courte sur ce qu'on a sous les yeux. */
          }}
          onSend={(text) => void chat.send(text)}
        />
      </aside>
    </>
  );
}
