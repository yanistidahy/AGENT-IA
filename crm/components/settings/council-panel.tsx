"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Portrait } from "@/components/agents/portrait";
import { requestJson } from "@/lib/client/http";
import {
  ACCEPTED_UPLOAD_MIMES,
  CADENCE_LABELS,
  SHIFT_CADENCES,
  type ShiftCadence,
} from "@/lib/domain/agent-identity";
import type { AgentProfile } from "@/lib/api/agents";

/**
 * Édition de l'identité d'un agent.
 *
 * Le `slug` est affiché mais **non modifiable**, et c'est le point à
 * comprendre : c'est lui qui relie l'agent à sa personnalité, à ses
 * conversations et à ses recommandations. Le rendre éditable transformerait un
 * renommage en migration de données ; le nom affiché, lui, se change librement.
 */

const FIELD =
  "w-full rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-flux";
const BUTTON =
  "rounded-control border border-line bg-surface px-2.5 py-1 text-[12px] font-semibold transition-colors hover:bg-surface-2 disabled:opacity-50";

function AgentRow({ agent }: { readonly agent: AgentProfile }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(agent.name);
  const [role, setRole] = useState(agent.role);
  const [cadence, setCadence] = useState<ShiftCadence>(agent.cadence);
  const [enabled, setEnabled] = useState(agent.enabled);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await requestJson(
      `/api/agents/${agent.slug}`,
      {
        method: "PATCH",
        body: JSON.stringify({ name, role, cadence, enabled }),
      },
      (value): value is Record<string, unknown> => typeof value === "object" && value !== null,
    );
    setBusy(false);
    if (result.ok) {
      setNotice("Enregistré.");
      router.refresh();
    } else {
      setError(result.message);
    }
  };

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    setNotice(null);

    const body = new FormData();
    body.append("photo", file);

    // `fetch` direct plutôt que `requestJson` : le corps est un `FormData`, et
    // lui imposer un `Content-Type: application/json` empêcherait le navigateur
    // d'écrire la frontière multipart.
    try {
      const response = await fetch(`/api/agents/${agent.slug}/photo`, { method: "POST", body });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof payload.error === "object" &&
          payload.error !== null &&
          "message" in payload.error &&
          typeof payload.error.message === "string"
            ? payload.error.message
            : "L'envoi a échoué.";
        setError(message);
        return;
      }
      setNotice("Photo enregistrée.");
      router.refresh();
    } catch {
      setError("La connexion au serveur a été interrompue.");
    } finally {
      setBusy(false);
      if (fileInput.current !== null) fileInput.current.value = "";
    }
  };

  const removePhoto = async () => {
    setBusy(true);
    setError(null);
    const result = await requestJson(
      `/api/agents/${agent.slug}/photo`,
      { method: "DELETE" },
      (value): value is Record<string, unknown> => typeof value === "object" && value !== null,
    );
    setBusy(false);
    if (result.ok) {
      setNotice("Photo retirée. Les initiales reprennent la place.");
      router.refresh();
    } else {
      setError(result.message);
    }
  };

  return (
    <li className="flex flex-wrap items-start gap-3 border-b border-line py-3 last:border-b-0">
      <Portrait
        agent={{ ...agent, name, role }}
        size="thumb"
        className="h-20 w-14 shrink-0 rounded-card"
        initialsClassName="text-[16px]"
      />

      <div className="grid min-w-[240px] flex-1 gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-0.5 block text-[11.5px] text-muted">Nom</span>
          <input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[11.5px] text-muted">Rôle affiché</span>
          <input className={FIELD} value={role} onChange={(e) => setRole(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[11.5px] text-muted">Cadence</span>
          <select
            className={FIELD}
            value={cadence}
            onChange={(e) => setCadence(e.target.value as ShiftCadence)}
          >
            {SHIFT_CADENCES.map((value) => (
              <option key={value} value={value}>
                {CADENCE_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-end gap-2">
          <label className="flex items-center gap-1.5 text-[12.5px]">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Actif
          </label>
          <span className="font-mono text-[10px] text-muted" title="Identifiant technique, non modifiable">
            {agent.slug}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <button type="button" className={BUTTON} disabled={busy} onClick={() => void save()}>
            Enregistrer
          </button>

          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED_UPLOAD_MIMES.join(",")}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file !== undefined) void upload(file);
            }}
          />
          <button
            type="button"
            className={BUTTON}
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            {agent.hasPhoto ? "Remplacer la photo" : "Ajouter une photo"}
          </button>

          {agent.hasPhoto && (
            <button
              type="button"
              className={BUTTON}
              disabled={busy}
              onClick={() => void removePhoto()}
            >
              Retirer
            </button>
          )}

          {agent.locked && (
            <span className="text-[11.5px] text-muted">Verrouillé par variable d'environnement</span>
          )}
        </div>

        {notice !== null && <p className="text-[12px] text-flux-d sm:col-span-2">{notice}</p>}
        {error !== null && <p className="text-[12px] text-[#B2311F] sm:col-span-2">{error}</p>}
      </div>
    </li>
  );
}

export function CouncilPanel({ agents }: { readonly agents: readonly AgentProfile[] }) {
  return (
    <div>
      <p className="mb-1 text-[12.5px] text-muted">
        Le nom, le rôle et la photo sont des réglages. La personnalité, les outils et le
        périmètre restent dans le code, retrouvés par l'identifiant technique — renommer un
        agent ne change donc jamais ce qu'il sait faire. JPEG, PNG ou WebP, 5 Mo maximum.
      </p>
      <ul>
        {agents.map((agent) => (
          <AgentRow key={agent.slug} agent={agent} />
        ))}
      </ul>
    </div>
  );
}
