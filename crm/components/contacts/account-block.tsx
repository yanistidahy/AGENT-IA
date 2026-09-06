"use client";

import { useState } from "react";
import Link from "next/link";
import { requestJson } from "@/lib/client/http";
import { formatDate } from "@/lib/format";
import type { Colleague } from "@/lib/api/account";

/**
 * Le compte, vu depuis la fiche : les collègues, et la note pour Alex.
 *
 * Les deux sont réunis parce qu'on les remplit au même moment — pendant la
 * recherche, avant d'écrire. Séparés en deux blocs distants, la note se
 * remplirait après coup, c'est-à-dire jamais.
 */

const CONTROL =
  "w-full rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-brand";

function isContact(value: unknown): value is { contact: unknown } {
  return typeof value === "object" && value !== null && "contact" in value;
}

/**
 * Ce qu'on sait de cette personne, et qu'Alex doit savoir.
 *
 * Distincte des Notes : celles-ci portent le déversoir de l'import — lignes
 * `SITE :`, `N° :`, titres de page — qu'on ne peut pas envoyer à un modèle sans
 * lui faire prendre un titre d'onglet pour un fait. Ce champ-ci ne contient que
 * ce que quelqu'un a délibérément écrit, donc il part dans le dossier tel quel.
 */
export function AlexNote({
  contactId,
  value,
  onSaved,
}: {
  readonly contactId: string;
  readonly value: string;
  readonly onSaved: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    const result = await requestJson(
      `/api/contacts/${contactId}`,
      { method: "PATCH", body: JSON.stringify({ alexNote: draft }) },
      isContact,
    );
    setBusy(false);
    if (result.ok) {
      setSaved(true);
      onSaved();
    } else {
      setError(result.message);
    }
  };

  return (
    <section className="mt-4">
      <h3 className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
        Note pour Alex
      </h3>
      <p className="mt-1 mb-1.5 text-[12px] text-muted">
        Un fait précis sur cette personne — « elle vient de poster sur les délais de
        livraison ». Il entre tel quel dans le dossier de rédaction.
      </p>
      <textarea
        rows={2}
        value={draft}
        placeholder="Ce que vous savez d'elle et qui doit peser sur le message."
        onChange={(event) => {
          setSaved(false);
          setDraft(event.target.value);
        }}
        className={CONTROL}
      />
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy || draft === value}
          className="min-h-[44px] rounded-control border border-line px-3 text-[13px] hover:border-brand disabled:opacity-50 lg:min-h-0 lg:py-1.5"
        >
          {busy ? "Enregistrement…" : "Enregistrer la note"}
        </button>
        {saved && <span className="text-[12px] text-win-d">Enregistrée.</span>}
        {error !== null && <span className="text-[12px] text-danger">{error}</span>}
      </div>
    </section>
  );
}

/**
 * Les collègues déjà en base, et ce qu'ils ont reçu.
 *
 * **La date du dernier message compte autant que le nom.** Deux personnes d'une
 * même maison comparent leurs emails ; savoir qu'on a écrit à la fondatrice il
 * y a trois jours change ce qu'on écrit à sa responsable SAV — c'est le fait
 * qui manquait, et son absence ne se voyait qu'après coup.
 */
export function Colleagues({
  colleagues,
  onOpen,
}: {
  readonly colleagues: readonly Colleague[];
  readonly onOpen: (id: string) => void;
}) {
  if (colleagues.length === 0) return null;

  return (
    <section className="mt-4">
      <h3 className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
        Dans la même maison ({colleagues.length})
      </h3>
      <ul className="mt-1.5 grid gap-1.5">
        {colleagues.map((colleague) => (
          <li
            key={colleague.id}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-card border border-line px-3 py-2 text-[13px]"
          >
            <button
              type="button"
              onClick={() => onOpen(colleague.id)}
              className="font-semibold hover:underline"
            >
              {colleague.name}
            </button>
            <span className="text-[12.5px] text-muted">
              {colleague.title === "" ? "fonction non renseignée" : colleague.title}
            </span>
            <span className="ml-auto text-[12px] text-muted">
              {colleague.lastEmailAt === null
                ? "jamais écrit"
                : `écrit le ${formatDate(colleague.lastEmailAt)}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Le lien vers toutes les fiches de la maison, pour travailler le compte entier. */
export function AccountLink({
  companyId,
  companyName,
}: {
  readonly companyId: string;
  readonly companyName: string;
}) {
  return (
    <Link
      href={`/contacts?societe=${encodeURIComponent(companyId)}&lifecycle=all`}
      className="mt-2 inline-block text-[12.5px] text-brand-d hover:underline"
    >
      Voir toutes les fiches de {companyName}
    </Link>
  );
}
