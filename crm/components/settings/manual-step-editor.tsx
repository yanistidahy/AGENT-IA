"use client";

import { useRef } from "react";
import {
  droppedSentences,
  MERGE_TAGS,
  renderSubject,
  subjectFallbacks,
  subjectTagErrors,
  renderTemplate,
  unknownTags,
  unresolvedTags,
  type MergeValues,
} from "@/lib/domain/merge-tags";
import { GROUP_LABELS, isContactGroup } from "@/lib/domain/contact-group";
import { RenderedBody } from "./rendered-body";
import {
  DEFAULT_VIDEO_DISPLAY,
  VIDEO_DISPLAY_LABELS,
  VIDEO_DISPLAY_NOTES,
  type VideoDisplay,
} from "@/lib/domain/video-display";

/**
 * L'éditeur d'une étape écrite à la main.
 *
 * **L'aperçu est la moitié de la fonction.** Un gabarit ne se relit pas : ce
 * qu'on veut voir avant d'enregistrer, c'est ce que *reçoit* quelqu'un — et
 * surtout ce que reçoit une fiche incomplète, parce que c'est le cas auquel on
 * ne pense pas. Il est donc rendu par **la même fonction que la composition**
 * (`lib/domain/merge-tags`), à la frappe, sans aller-retour : un aperçu calculé
 * autrement montrerait un texte que l'envoi ne produit pas.
 *
 * Les contacts d'aperçu sont **réels**, pris parmi les inscrits, et le cas
 * dégradé passe devant (`sampleContacts`).
 */

export interface SampleContact {
  readonly id: string;
  readonly name: string;
  readonly values: MergeValues;
  /** Le groupe de fonction de la fiche : c'est lui qui choisit la variante. */
  readonly group: string;
  /** `none` = jamais classée, donc message par défaut (jamais « Autre »). */
  readonly groupSetBy: string;
}

/**
 * **Tous les destinataires, plus le compte réel par groupe.**
 *
 * `totals` n'est pas déduit de `contacts` : la liste est bornée côté serveur
 * (500 fiches), le compte ne l'est pas. Les confondre ferait annoncer « 500
 * contacts dans ce groupe » sur un portefeuille qui en porte mille.
 */
export interface SampleSet {
  readonly contacts: readonly SampleContact[];
  readonly totals: Readonly<Record<string, number>>;
  /** `false` = personne n'est inscrit, l'aperçu porte sur tout le CRM. */
  readonly enrolled: boolean;
  /** Le mode d'affichage de la vidéo, réglé dans /reglages. */
  readonly videoDisplay: VideoDisplay;
}

export const EMPTY_SAMPLES: SampleSet = {
  contacts: [],
  totals: {},
  enrolled: true,
  videoDisplay: DEFAULT_VIDEO_DISPLAY,
};

/** La clé de groupe d'une fiche : `none` pour une fiche jamais classée. */
export function groupKeyOf(sample: SampleContact): string {
  return sample.groupSetBy === "none" ? "none" : sample.group;
}

const FIELD =
  "w-full rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] focus:border-brand focus:outline-none";

export function ManualStepEditor({
  subject,
  body,
  samples,
  sampleId,
  onSample,
  onChange,
  tab = "default",
  scope = "le message par défaut",
  lockedSubject = null,
}: {
  readonly subject: string;
  readonly body: string;
  readonly samples: SampleSet;
  readonly sampleId: string;
  readonly onSample: (id: string) => void;
  readonly onChange: (change: { subject?: string; body?: string }) => void;
  /** Quel texte est édité — la rangée de variantes vit au-dessus. */
  readonly tab?: string;
  /** Ce que l'écran est en train d'écrire, dit en clair au-dessus des champs. */
  readonly scope?: string;
  /**
   * L'objet imposé par l'étape 1, sur une relance. `null` sur l'étape 1
   * elle-même, où l'objet se saisit.
   */
  readonly lockedSubject?: string | null;
}) {
  const area = useRef<HTMLTextAreaElement | null>(null);
  const line = useRef<HTMLInputElement | null>(null);
  /**
   * Quel champ a eu le focus en dernier, **objet ou message**.
   *
   * C'était le défaut : `insert` écrivait toujours dans `body`, et le champ
   * Objet ne portait aucune référence. Cliquer une puce en écrivant son objet
   * envoyait donc la balise à la fin du message, hors de vue — la puce
   * paraissait morte, et les balises inutilisables dans un objet.
   *
   * Le focus est mémorisé au `focus` plutôt que lu au clic : le bouton prend le
   * focus dès qu'on appuie dessus, donc `document.activeElement` désignerait
   * toujours le bouton. Le repli est le message, le champ le plus long.
   */
  const focused = useRef<"subject" | "body">("body");

  /** Insère la balise au curseur du dernier champ focalisé. */
  const insert = (tag: string) => {
    const target = focused.current === "subject" ? "subject" : "body";
    const node = target === "subject" ? line.current : area.current;
    const text = target === "subject" ? subject : body;

    if (node === null) {
      onChange(target === "subject" ? { subject: `${text}${tag}` } : { body: `${text}${tag}` });
      return;
    }

    const start = node.selectionStart ?? text.length;
    const end = node.selectionEnd ?? start;
    const next = `${text.slice(0, start)}${tag}${text.slice(end)}`;
    onChange(target === "subject" ? { subject: next } : { body: next });

    // Le curseur reste après la balise : on continue de taper sa phrase.
    requestAnimationFrame(() => {
      node.focus();
      node.setSelectionRange(start + tag.length, start + tag.length);
    });
  };

  /*
    **Le menu porte tout le groupe édité, pas un échantillon.**

    C'est la correction du défaut : la version d'avant ne gardait qu'une fiche
    par groupe, donc le menu ne pouvait jamais en offrir plus de cinq — et en
    offrait exactement une quand un seul groupe était inscrit. Ici la liste est
    celle du groupe qu'on est en train d'écrire, triée par nom côté serveur, et
    le compteur donne le **vrai** total du groupe même si la liste est bornée.

    L'onglet « défaut » ne filtre rien : le message par défaut part à tous les
    groupes qui n'ont pas de variante, il se relit donc sur n'importe quelle
    fiche.
  */
  const scopeKey = isContactGroup(tab) ? tab : null;
  const shown =
    scopeKey === null
      ? samples.contacts
      : samples.contacts.filter((entry) => groupKeyOf(entry) === scopeKey);
  const total = scopeKey === null ? samples.contacts.length : (samples.totals[scopeKey] ?? 0);

  const sample = shown.find((entry) => entry.id === sampleId) ?? shown[0] ?? null;
  // Le repli décrit une fiche dont on ne sait rien : **toutes les valeurs
  // vides**, y compris la vidéo. Y mettre un libellé par défaut ferait annoncer
  // une phrase que l'envoi retirerait faute de vidéo réglée.
  const values: MergeValues = sample?.values ?? {
    prenom: "",
    nom: "",
    fonction: "",
    societe: "",
    site: "",
    video: "",
    notresite: "",
  };

  /*
    **L'objet et le message ne se jugent pas de la même façon**, et les mêler
    faisait dire « balise sans valeur » pour un objet qui la traite désormais par
    un repli neutre. Le message annonce ses phrases retirées, l'objet ses replis.
  */
  /** L'objet qui partira : celui de l'étape 1 sur une relance, le sien sinon. */
  const liveSubject = lockedSubject ?? subject;
  const missing = sample === null ? [] : unresolvedTags(body, values);
  const unknown = unknownTags(`${liveSubject}\n${body}`);
  /** Les balises que l'objet ne peut pas porter — {video} en tête. */
  const subjectErrors = subjectTagErrors(liveSubject);
  /** Les replis que **cette** fiche déclenchera dans l'objet. */
  const subjectNotes = sample === null ? [] : subjectFallbacks(liveSubject, values);
  // Les phrases que le rendu va retirer pour **cette** fiche, avec leur raison.
  const dropped = sample === null ? [] : droppedSentences(body, values);

  return (
    <div className="sm:col-span-2">
      <p className="mb-1.5 text-[11.5px] text-muted" data-variant-scope={tab}>
        Vous écrivez <b className="font-semibold text-ink">{scope}</b>.
      </p>

      {lockedSubject !== null ? (
        <div data-subject-locked="1">
          <span className="block text-[11.5px] font-semibold text-muted">
            Objet — celui de l&apos;étape 1
          </span>
          <p className="rounded-control border border-line bg-surface-2 px-2.5 py-1.5 font-mono text-[12.5px] text-muted">
            {lockedSubject === "" ? "(l'étape 1 ne porte pas encore d'objet)" : lockedSubject}
          </p>
          <p className="mt-1 text-[11.5px] text-muted">
            Une relance garde l&apos;objet du premier message : les messageries regroupent par
            objet, donc en changer ouvrirait une seconde conversation et le message auquel
            cette relance répond se perdrait. Aucun «&nbsp;Re:&nbsp;» n&apos;est ajouté — ce
            n&apos;est pas une réponse.
          </p>
        </div>
      ) : (
      <label className="block">
        <span className="block text-[11.5px] font-semibold text-muted">Objet</span>
        <input
          ref={line}
          data-field="subject"
          className={FIELD}
          value={subject}
          placeholder="ex. Une démonstration préparée pour {societe}"
          onFocus={() => {
            focused.current = "subject";
          }}
          onChange={(event) => onChange({ subject: event.target.value })}
        />
      </label>
      )}

      {/*
        **Refusé, pas corrigé en silence.** Un lien ne se clique pas dans un
        objet : remplacer la balise par son libellé ferait partir un appel à
        l'action qui n'en est pas un. La raison est celle du domaine, donc la
        route d'enregistrement dit exactement la même phrase.
      */}
      {subjectErrors.length > 0 && (
        <p
          data-subject-error="1"
          className="mt-1.5 rounded-control border border-danger bg-surface p-2 text-[11.5px] text-danger"
        >
          {subjectErrors.map((entry) => `${entry.tag} : ${entry.reason}`).join(" · ")}. Retirez-la
          de l&apos;objet — elle reste utilisable dans le message.
        </p>
      )}

      <label className="mt-2 block">
        <span className="block text-[11.5px] font-semibold text-muted">Message</span>
        <textarea
          ref={area}
          data-field="body"
          className={`${FIELD} min-h-[180px] font-mono text-[12.5px] leading-relaxed`}
          value={body}
          onFocus={() => {
            focused.current = "body";
          }}
          placeholder={"Bonjour {prenom},\n\nEn regardant {societe}…"}
          onChange={(event) => onChange({ body: event.target.value })}
        />
      </label>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[11.5px] text-muted">Insérer :</span>
        {MERGE_TAGS.map((tag) => (
          <button
            key={tag.tag}
            type="button"
            title={tag.fallback}
            onClick={() => insert(tag.tag)}
            className="min-h-[44px] rounded-control border border-line bg-surface-2 px-2 font-mono text-[11.5px] text-ink hover:border-brand hover:text-brand-d lg:min-h-0 lg:py-1"
          >
            {tag.tag}
          </button>
        ))}
      </div>

      <p className="mt-1.5 text-[11.5px] text-muted">
        La signature est ajoutée à l&apos;envoi, comme pour un message d&apos;Alex — ne la
        retapez pas. Une balise sans valeur n&apos;est jamais envoyée telle quelle : sans
        prénom l&apos;appel devient « Bonjour, », et la phrase qui cite une société ou un
        site inconnus est retirée.
      </p>

      {unknown.length > 0 && (
        <p className="mt-1.5 rounded-control border border-danger bg-surface p-2 text-[11.5px] text-danger">
          Balise inconnue : {unknown.join(", ")}. Elle partirait telle quelle chez le
          destinataire. Les seules balises reconnues sont{" "}
          {MERGE_TAGS.map((tag) => tag.tag).join(", ")}.
        </p>
      )}

      {samples.contacts.length > 0 && sample === null && (
        <p className="mt-2 rounded-control border border-line bg-surface-2 p-2 text-[11.5px] text-muted">
          Aucun contact {scopeKey === null ? "" : `dans le groupe « ${GROUP_LABELS[scopeKey]} »`}{" "}
          parmi les destinataires de cette campagne : rien à prévisualiser pour cette
          variante. Inscrivez-en, ou relisez le message par défaut.
        </p>
      )}

      {shown.length > 0 && sample !== null && (
        <div className="mt-2 rounded-card border border-line bg-surface-2 p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11.5px] font-semibold text-muted">Aperçu pour</span>
            <select
              className="rounded-control border border-line bg-surface px-2 py-1 text-[12px]"
              value={sample.id}
              onChange={(event) => onSample(event.target.value)}
            >
              {shown.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                  {entry.values.prenom.trim() === "" ? " — sans prénom" : ""}
                  {entry.values.site.trim() === "" ? " — sans site" : ""}
                </option>
              ))}
            </select>
            <span className="text-[11.5px] text-muted" data-sample-count={total}>
              {scopeKey === null
                ? `${total} contact${total > 1 ? "s" : ""} dans cette campagne`
                : `${total} contact${total > 1 ? "s" : ""} dans ce groupe`}
              {shown.length < total ? ` — les ${shown.length} premiers sont listés` : ""}
            </span>
            {!samples.enrolled && (
              <span className="text-[11.5px] text-muted">
                Aucun inscrit : aperçu sur tous les contacts du CRM.
              </span>
            )}
          </div>

          {missing.length > 0 && (
            <p className="mt-1.5 text-[11.5px] text-muted">
              Pour cette fiche : {missing.join(", ")} sans valeur — voir le rendu ci-dessous.
            </p>
          )}

          {dropped.length > 0 && (
            <div className="mt-1.5 rounded-control border border-gold bg-gold-l p-2 text-[11.5px]">
              {dropped.map((entry, index) => (
                <p key={`${entry.tag}-${index}`} className="text-ink">
                  <b className="font-semibold">Phrase retirée pour ce contact : {entry.label}</b>{" "}
                  — «&nbsp;{entry.sentence}&nbsp;»
                </p>
              ))}
              <p className="mt-1 text-muted">
                La phrase entière part plutôt que la seule balise : une phrase construite
                autour d&apos;un nom qu&apos;on n&apos;a pas ne survit pas à son retrait.
                Vérifiez que ce qui reste s&apos;ouvre correctement.
              </p>
            </div>
          )}

          <p className="mt-2 text-[11.5px] font-semibold text-muted">Objet</p>
          <p className="text-[12.5px] text-ink" data-preview-subject="1">
            {renderSubject(liveSubject, values)}
          </p>
          {/*
            **Un repli employé se dit.** Sinon « votre marque » part à quelqu'un
            dont on connaît la société, et personne ne s'aperçoit que la fiche
            est incomplète — la carte du départ porte la même phrase.
          */}
          {subjectNotes.length > 0 && (
            <p
              data-subject-fallback="1"
              className="mt-1 rounded-control border border-gold bg-gold-l px-2 py-1 text-[11.5px] text-ink"
            >
              Objet : {subjectNotes.join(" · ")}.
            </p>
          )}
          <p className="mt-1.5 text-[11.5px] font-semibold text-muted">Message</p>
          <RenderedBody text={renderTemplate(body, values)} ourSiteUrl={values.notresite} />
          {values.video !== "" && body.includes("{video}") && (
            <p className="mt-1.5 text-[12px] text-muted">
              Vidéo : mode <strong>{VIDEO_DISPLAY_LABELS[samples.videoDisplay]}</strong>.{" "}
              {VIDEO_DISPLAY_NOTES[samples.videoDisplay]} Réglable dans Réglages → Vidéo de
              démonstration.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
