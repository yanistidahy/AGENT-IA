"use client";

import { useRef, useState } from "react";
import { LOGO_WIDTH } from "@/lib/domain/signature-logo";

/**
 * Le logo de la signature HTML — téléversement, aperçu, retrait.
 *
 * **Un seul logo pour toutes les boîtes**, et c'est dit à l'écran : c'est la
 * marque de l'entreprise, pas celle d'une personne. Ce qui change d'un
 * signataire à l'autre — nom, titre, téléphone, adresse — se règle sur la boîte,
 * juste au-dessus.
 *
 * L'avertissement de poids est rendu **ici**, au moment où le fichier est
 * choisi : c'est là que la décision se prend, et un logo trop lourd doit se
 * dire tout de suite plutôt que se découvrir dans les statistiques de
 * délivrabilité trois semaines plus tard.
 */

export interface LogoState {
  readonly logo: {
    readonly version: string;
    readonly width: number;
    readonly bytes: number;
  } | null;
  /** L'adresse publique servie. Vide = aucune adresse publique connue. */
  readonly url: string;
  readonly warnings: readonly string[];
}

function isLogoState(value: unknown): value is LogoState {
  return typeof value === "object" && value !== null && "logo" in value && "url" in value;
}

export function LogoPanel({ initial }: { readonly initial: LogoState }) {
  const [state, setState] = useState<LogoState>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const call = async (init: RequestInit) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/mail/logo", init);
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && "error" in payload
            ? String((payload as { error: { message?: string } }).error.message ?? "")
            : "";
        setError(message === "" ? "Le téléversement a échoué." : message);
        return;
      }
      if (isLogoState(payload)) setState(payload);
    } catch {
      setError("Le serveur n'a pas répondu.");
    } finally {
      setBusy(false);
      if (input.current !== null) input.current.value = "";
    }
  };

  const upload = async (file: File) => {
    const form = new FormData();
    form.set("logo", file);
    await call({ method: "POST", body: form });
  };

  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card">
      <h3 className="mb-1 font-display text-[14px] font-semibold">Logo de la signature</h3>
      <p className="mb-3 text-[12.5px] text-muted">
        Un seul logo, partagé par toutes les boîtes : c'est la marque, pas la personne. Il
        n'apparaît que dans la version HTML du message, sous les quatre lignes de signature.
        La version texte n'en porte aucune trace — un client texte ne saurait pas la rendre.
      </p>

      {state.logo === null ? (
        <p className="mb-3 rounded-control border border-dashed border-line px-3 py-4 text-center text-[12.5px] text-muted">
          Aucun logo. Les messages partent avec la signature texte seule.
        </p>
      ) : (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-control border border-line-2 px-3 py-2">
          {/*
            L'aperçu passe par un chemin **relatif**, jamais par l'adresse
            publique : le navigateur qui affiche cet écran parle déjà au CRM,
            il voit donc toujours le logo. L'adresse absolue est une question
            de délivrabilité, pas d'affichage — la confondre avec l'aperçu
            ferait disparaître l'image ici au moment précis où l'on a besoin
            de vérifier à quoi elle ressemble.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element -- c'est l'octet
              exact servi aux clients de messagerie qu'on veut voir, pas une
              version retaillée par l'optimiseur de Next. */}
          <img
            src={`/api/logo/${state.logo.version}`}
            alt="Aura Flow AI"
            width={state.logo.width}
          />
          <div className="text-[12px] text-muted">
            <div>
              {state.logo.width} px · {(state.logo.bytes / 1024).toFixed(1)} Ko
            </div>
            <div className="font-mono text-[11px]">
              {state.url === "" ? (
                <span className="text-danger">
                  Aucune adresse publique connue (CRM_PUBLIC_URL) : le logo ne partira pas.
                </span>
              ) : (
                state.url
              )}
            </div>
          </div>
        </div>
      )}

      {state.warnings.length > 0 && (
        <ul className="mb-3 rounded-control border border-gold bg-gold-l px-3 py-2 text-[12.5px]">
          {state.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file !== undefined) void upload(file);
          }}
          className="min-h-[44px] text-[12.5px] lg:min-h-0"
        />
        {state.logo !== null && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void call({ method: "DELETE" })}
            className="min-h-[44px] text-[12px] text-muted hover:text-danger disabled:opacity-50 lg:min-h-0"
          >
            Retirer le logo
          </button>
        )}
      </div>

      <p className="mt-2 text-[12px] text-muted">
        PNG, JPEG ou WebP. Le fichier est réencodé en PNG et ramené à {LOGO_WIDTH} px de large,
        quelle que soit sa taille d'origine. SVG refusé : il peut porter du script, et les
        clients de messagerie ne l'affichent pas.
      </p>

      {error !== null && <p className="mt-2 text-[12px] text-danger">{error}</p>}
    </section>
  );
}
