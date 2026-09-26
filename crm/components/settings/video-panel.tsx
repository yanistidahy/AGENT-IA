"use client";

import { useState } from "react";
import {
  VIDEO_POSTER_WIDTH,
  describeSize,
  MAX_VIDEO_UPLOAD,
  type VideoKind,
} from "@/lib/domain/signature-video";

/**
 * La vidéo de démonstration — hébergement, vignette, libellé.
 *
 * **Jamais une pièce jointe**, et l'écran le dit en toutes lettres : une vidéo
 * attachée est l'un des signaux de spam les plus forts, beaucoup de serveurs la
 * mettent en quarantaine sans un mot, et IONOS applique sa propre limite de
 * taille par message. Ce qui part est une vignette de quelques dizaines de
 * kilo-octets et un lien.
 *
 * Deux voies, et **la seule différence qui compte pour le destinataire est
 * affichée à côté du choix** : téléverser garde le clic chez nous, coller une
 * adresse l'envoie chez l'hébergeur. Faire passer ce clic par une redirection de
 * notre domaine serait précisément le pistage qu'on s'interdit, en plus de
 * masquer où l'on va — on le dit donc plutôt que de le taire.
 */

export interface VideoState {
  readonly video: {
    readonly kind: VideoKind;
    readonly url: string;
    readonly label: string;
    readonly version: string;
    readonly posterWidth: number;
    readonly posterBytes: number;
    readonly posterGenerated: boolean;
    readonly fileBytes: number;
    readonly fileMime: string;
    /** Le clic reste-t-il sur notre domaine ? */
    readonly ourDomain: boolean;
  } | null;
  /** L'adresse publique de la vignette. Vide = aucune adresse publique connue. */
  readonly posterUrl: string;
  /** Où mène le clic, résolu. Vide = aucun lien composable. */
  readonly destination: string;
  readonly warnings: readonly string[];
}

function isVideoState(value: unknown): value is VideoState {
  return typeof value === "object" && value !== null && "video" in value && "posterUrl" in value;
}

const DEFAULT_LABEL = "Voir la démonstration en vidéo";

export function VideoPanel({ initial }: { readonly initial: VideoState }) {
  const [state, setState] = useState<VideoState>(initial);
  const [kind, setKind] = useState<VideoKind>(initial.video?.kind ?? "hosted");
  const [url, setUrl] = useState(initial.video?.url ?? "");
  const [label, setLabel] = useState(initial.video?.label ?? DEFAULT_LABEL);
  const [file, setFile] = useState<File | null>(null);
  const [poster, setPoster] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const call = async (init: RequestInit) => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/mail/video", init);
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && "error" in payload
            ? String((payload as { error: { message?: string } }).error.message ?? "")
            : "";
        setError(message === "" ? "L'enregistrement a échoué." : message);
        return;
      }
      if (isVideoState(payload)) {
        setState(payload);
        setKind(payload.video?.kind ?? "hosted");
        setUrl(payload.video?.url ?? "");
        setLabel(payload.video?.label ?? DEFAULT_LABEL);
        setSaved(true);
      }
      setFile(null);
      setPoster(null);
    } catch {
      setError("Le serveur n'a pas répondu.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const form = new FormData();
    form.set("kind", kind);
    form.set("url", url);
    form.set("label", label);
    if (file !== null) form.set("fichier", file);
    if (poster !== null) form.set("vignette", poster);
    await call({ method: "POST", body: form });
  };

  const limite = describeSize(MAX_VIDEO_UPLOAD);

  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card">
      <h3 className="mb-1 font-display text-[14px] font-semibold">Vidéo de démonstration</h3>
      <p className="mb-3 text-[12.5px] text-muted">
        Utilisable dans une étape écrite à la main par la balise{" "}
        <code className="rounded bg-surface-2 px-1 font-mono text-[11.5px]">{"{video}"}</code>.
        Elle part comme <strong>une vignette cliquable</strong> en HTML et comme{" "}
        <strong>l'adresse écrite en entier</strong> en texte brut —{" "}
        <strong>jamais en pièce jointe</strong> : une vidéo attachée est l'un des signaux de
        spam les plus forts, et IONOS refuserait le message pour sa taille. Sans vidéo réglée,
        la phrase qui porte la balise disparaît proprement.
      </p>

      <fieldset className="mb-3">
        <legend className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-muted">
          Où vit la vidéo
        </legend>
        <div className="flex flex-col gap-1.5">
          {(
            [
              {
                value: "file" as VideoKind,
                title: "Chez nous",
                body: `Vous téléversez le fichier, ${limite} au plus. Le clic reste sur notre domaine, rien ne part chez un tiers. Un export MP4 H.264 en 1080p tient largement dans cette limite ; un ProRes ou un .mov d'export brut la dépasse toujours.`,
              },
              {
                value: "hosted" as VideoKind,
                title: "Chez un hébergeur",
                body: "Vous collez une adresse (YouTube non répertorié, Vimeo, un lien direct). Le clic va alors chez cet hébergeur, qui saura qui l'a ouverte.",
              },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className={`flex min-h-[44px] cursor-pointer items-start gap-2 rounded-control border px-3 py-2 text-[12.5px] ${
                kind === option.value ? "border-brand bg-brand-l" : "border-line-2"
              }`}
            >
              <input
                type="radio"
                name="video-kind"
                checked={kind === option.value}
                onChange={() => setKind(option.value)}
                className="mt-0.5"
              />
              <span>
                <strong>{option.title}</strong>
                <span className="block text-muted">{option.body}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {kind === "hosted" ? (
        <label className="mb-3 block text-[12.5px]">
          <span className="mb-1 block font-mono text-[11px] uppercase tracking-wide text-muted">
            Adresse de la vidéo
          </span>
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://vimeo.com/…"
            className="min-h-[44px] w-full rounded-control border border-line px-3 lg:min-h-0 lg:py-1.5"
          />
        </label>
      ) : (
        <label className="mb-3 block text-[12.5px]">
          <span className="mb-1 block font-mono text-[11px] uppercase tracking-wide text-muted">
            Fichier vidéo {state.video?.kind === "file" && "(laisser vide pour garder l'actuel)"}
          </span>
          <input
            type="file"
            accept="video/mp4,video/webm,video/ogg"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="min-h-[44px] w-full text-[12.5px] lg:min-h-0"
          />
          <span className="mt-1 block text-[12px] text-muted">
            MP4 (H.264), WebM ou OGG, <strong>{limite} au plus</strong>. Un{" "}
            <code className="font-mono text-[11.5px]">.mov</code> d'export — le défaut de la
            plupart des outils de motion design — n'est ni accepté ni lisible par les
            navigateurs : réexportez-le en MP4, ce qui divise aussi son poids par dix ou plus.
            Au-delà de la limite, hébergez la vidéo et collez son adresse : c'est immédiat et
            sans limite de taille.
          </span>
        </label>
      )}

      <label className="mb-3 block text-[12.5px]">
        <span className="mb-1 block font-mono text-[11px] uppercase tracking-wide text-muted">
          Libellé cliquable
        </span>
        <input
          type="text"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          className="min-h-[44px] w-full rounded-control border border-line px-3 lg:min-h-0 lg:py-1.5"
        />
        <span className="mt-1 block text-[12px] text-muted">
          C'est ce que {"{video}"} écrit dans le gabarit, le texte de l'ancre en HTML, et le mot
          placé devant l'adresse en texte brut.
        </span>
      </label>

      <label className="mb-3 block text-[12.5px]">
        <span className="mb-1 block font-mono text-[11px] uppercase tracking-wide text-muted">
          Image de la vignette
        </span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => setPoster(event.target.files?.[0] ?? null)}
          className="min-h-[44px] w-full text-[12.5px] lg:min-h-0"
        />
        <span className="mt-1 block text-[12px] text-muted">
          Facultative. Réencodée en JPEG de {VIDEO_POSTER_WIDTH} px de large, avec le triangle de
          lecture <strong>incrusté dans l'image</strong> — une surcouche posée par-dessus est
          ignorée par la moitié des clients de messagerie. Sans image, une plaque sobre est
          composée : aucun extracteur de trame n'est installé, on ne prétend donc pas montrer une
          image du film.
        </span>
      </label>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="min-h-[44px] rounded-control bg-brand px-3 text-[12.5px] font-semibold text-white hover:bg-brand-d disabled:opacity-50 lg:min-h-0 lg:py-1.5"
        >
          {busy ? "Enregistrement…" : "Enregistrer la vidéo"}
        </button>
        {state.video !== null && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void call({ method: "DELETE" })}
            className="min-h-[44px] text-[12px] text-muted hover:text-danger disabled:opacity-50 lg:min-h-0"
          >
            Retirer la vidéo
          </button>
        )}
        {saved && <span className="text-[12px] text-win-d">Enregistrée.</span>}
      </div>

      {state.video !== null && (
        <div className="mb-3 flex flex-wrap items-start gap-3 rounded-control border border-line-2 px-3 py-2">
          {/*
            Chemin **relatif**, jamais l'adresse publique : le navigateur qui
            affiche cet écran parle déjà au CRM, il voit donc toujours la
            vignette. L'adresse absolue est une question de délivrabilité, et
            les confondre ferait disparaître l'aperçu au moment précis où l'on
            veut vérifier l'image qu'on vient de choisir (défaut du jalon 62).
          */}
          {/* eslint-disable-next-line @next/next/no-img-element -- c'est l'octet
              exact servi aux clients de messagerie qu'on veut voir. */}
          <img
            src={`/api/video/${state.video.version}`}
            alt={state.video.label}
            width={240}
            className="rounded"
          />
          <div className="text-[12px] text-muted">
            <div>
              Vignette {state.video.posterWidth} px ·{" "}
              {(state.video.posterBytes / 1024).toFixed(1)} Ko
              {state.video.posterGenerated && " · engendrée, pas une image du film"}
              {state.video.fileBytes > 0 && (
                <> · fichier {(state.video.fileBytes / (1024 * 1024)).toFixed(1)} Mo</>
              )}
            </div>
            <div className="mt-1">
              {state.video.ourDomain ? (
                <span className="text-win-d">
                  Le clic reste sur notre domaine : la vidéo est servie par le CRM.
                </span>
              ) : (
                <span>
                  Le clic va chez l'hébergeur, qui verra qui ouvre la vidéo. Téléversez le
                  fichier pour que tout reste chez nous.
                </span>
              )}
            </div>
            <div className="mt-1 font-mono text-[11px]">
              {state.posterUrl === "" ? (
                <span className="text-danger">
                  Aucune adresse publique connue (CRM_PUBLIC_URL) : la vignette ne partira pas,
                  et la phrase qui porte {"{video}"} sera retirée.
                </span>
              ) : (
                <>
                  <div>vignette : {state.posterUrl}</div>
                  <div>
                    clic :{" "}
                    {state.destination === "" ? (
                      <span className="text-danger">aucune destination composable</span>
                    ) : (
                      state.destination
                    )}
                  </div>
                </>
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

      {error !== null && <p className="text-[12px] text-danger">{error}</p>}
    </section>
  );
}
