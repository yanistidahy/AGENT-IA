"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import { AUTO_MIN_VALIDATED } from "@/lib/domain/sequence-rules";
import { SequenceSteps } from "./sequence-steps";

/**
 * Les séquences d'emails, et l'interrupteur qui ne s'active pas tout seul.
 *
 * **Le mode automatique dit pourquoi il est verrouillé.** Un interrupteur grisé
 * sans explication se lit comme une panne, et on cherche comment le forcer ;
 * un interrupteur qui annonce « il manque 14 départs validés à la main et au
 * moins une réponse » énonce un contrat qu'on peut remplir.
 *
 * Il est verrouillé à l'écran **et** revérifié au serveur : l'écran n'est pas la
 * seule porte, et c'est la même leçon que l'acceptation groupée des domaines du
 * jalon 26.
 */

export interface SequenceStepView {
  id?: string;
  position: number;
  delayDays: number;
  brief: string;
  /** Le dernier objet réellement composé pour cette étape, s'il y en a un. */
  lastSubject?: string;
}

export interface SequenceView {
  id: string;
  name: string;
  active: boolean;
  autoMode: boolean;
  steps: SequenceStepView[];
  enrolled: number;
  running: number;
  unlock: { unlocked: boolean; validated: number; replies: number; reason: string };
}

function isReopenPlan(
  value: unknown,
): value is {
  message: string;
  exclusions: string;
  silence: string;
  plan: { candidates: unknown[] };
} {
  return typeof value === "object" && value !== null && "plan" in value;
}

function isPayload(
  value: unknown,
): value is {
  sequences: SequenceView[];
  sequence?: SequenceView;
} {
  return typeof value === "object" && value !== null && "sequences" in value;
}

const FIELD =
  "w-full rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] focus:border-brand focus:outline-none";
const BUTTON =
  "rounded-control px-3 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-50";

export function EmailSequencesPanel({
  initial,
  embedded = false,
}: {
  readonly initial: readonly SequenceView[];
  /**
   * Monté dans une carte de campagne : la séquence appartient alors à la
   * campagne, donc ni paragraphe d'introduction, ni bouton de création — une
   * séquence naît avec sa campagne, jamais seule (jalon 54).
   */
  readonly embedded?: boolean;
}) {
  const [sequences, setSequences] = useState<SequenceView[]>([...initial]);
  /**
   * Le nombre d'étapes **enregistrées**, par séquence.
   *
   * C'est lui qui dit qu'on vient d'en ajouter une : comparer à la liste
   * affichée ne dirait rien, puisqu'elle porte déjà la modification en cours.
   */
  const [savedSteps, setSavedSteps] = useState<Record<string, number>>(() =>
    Object.fromEntries(initial.map((entry) => [entry.id, entry.steps.length])),
  );
  const [confirm, setConfirm] = useState<{
    sequence: SequenceView;
    message: string;
    exclusions: string;
    /** Pourquoi personne ne rouvre — vide quand quelqu'un rouvre. */
    silence: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const patch = (id: string, change: Partial<SequenceView>) =>
    setSequences((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...change } : entry)),
    );

  /**
   * Enregistre, puis rouvre **si on l'a demandé**.
   *
   * L'ordre compte : rouvrir avant d'écrire les étapes rendrait des
   * inscriptions actives pour une étape qui n'existe pas encore en base, et la
   * composition suivante les refermerait aussitôt.
   */
  const save = async (sequence: SequenceView, reopen = false) => {
    setConfirm(null);
    setBusy(true);
    setError(null);
    setDone(null);
    const result = await requestJson(
      "/api/sequences-email",
      {
        method: "POST",
        body: JSON.stringify({
          id: sequence.id === "" ? undefined : sequence.id,
          name: sequence.name,
          active: sequence.active,
          autoMode: sequence.autoMode,
          steps: sequence.steps.map((step) => ({
            delayDays: step.delayDays,
            brief: step.brief,
          })),
        }),
      },
      isPayload,
    );
    setBusy(false);
    if (result.ok) {
      /*
        **Monté dans une carte de campagne, le panneau ne montre QUE sa
        séquence.** Il reprenait ici la liste entière rendue par le serveur —
        toutes les séquences du CRM — et la carte se mettait donc à afficher
        celles des autres campagnes, plus une éventuelle séquence orpheline.

        Conséquence vécue, reproduite au navigateur : un champ de consigne avant
        d'enregistrer, **deux après**. Le second enregistrement écrivait alors
        dans la mauvaise séquence, la consigne de la campagne semblait ne pas
        « prendre », et sa composition ne repartait pas. Le défaut ne levait
        rien : deux formulaires corrects, chacun sauvegardant une séquence qui
        existe.
      */
      setSequences((current) =>
        embedded
          ? current.map((entry) =>
              // `entry.id === ""` ne peut pas arriver ici — une séquence naît
              // avec sa campagne (jalon 54), le panneau embarqué n'a pas de
              // bouton de création — mais la retomber sur la séquence
              // enregistrée plutôt que sur rien coûte une ligne.
              result.data.sequences.find(
                (saved) => saved.id === (entry.id === "" ? result.data.sequence?.id : entry.id),
              ) ?? entry,
            )
          : result.data.sequences,
      );
      /*
        **Enregistrer n'est qu'un enregistrement**, depuis le jalon 70 : aucun
        appel au modèle, aucun départ composé, aucune facture. Écrire les mails
        est un geste séparé, avec son bouton et son estimation de coût.
      */
      setSavedSteps((current) => ({
        ...current,
        [result.data.sequence?.id ?? sequence.id]: sequence.steps.length,
      }));

      if (reopen) {
        const reopened = await requestJson(
          "/api/sequences-email/reopen",
          { method: "PUT", body: JSON.stringify({ sequenceId: sequence.id }) },
          (value): value is { reopened: number } =>
            typeof value === "object" && value !== null && "reopened" in value,
        );
        if (!reopened.ok) {
          setError(reopened.message);
          return;
        }
        /*
          **Zéro rouverture après une confirmation qui en annonçait est une
          contradiction, pas un succès.** Le plan lit les étapes *proposées*,
          l'écriture lit celles qui sont *en base* : si l'enregistrement n'a
          pas porté, la promesse et le résultat divergent — et c'est
          exactement le genre d'écart qui s'est lu « rien ne se passe » en
          production. On le dit, plutôt que d'annoncer « enregistrée ».
        */
        if (reopened.data.reopened === 0) {
          setError(
            "Séquence enregistrée, mais aucune inscription n'a été rouverte alors que la confirmation en annonçait. Rechargez l'écran : l'étape n'a peut-être pas été enregistrée.",
          );
          return;
        }
        setDone(
          `Séquence enregistrée. ${reopened.data.reopened} inscription${
            reopened.data.reopened > 1 ? "s" : ""
          } rouverte${reopened.data.reopened > 1 ? "s" : ""} — les personnes dues entreront dans la prochaine composition.`,
        );
        return;
      }
      setDone("Séquence enregistrée.");
    } else setError(result.message);
  };

  /**
   * Le clic sur « Enregistrer ».
   *
   * **On ne rouvre jamais sans avoir montré qui.** Ajouter une étape à une
   * campagne qui a tourné peut relancer cinquante-deux personnes : c'est une
   * décision, pas un effet de bord d'un enregistrement — et certaines
   * campagnes, on ne veut précisément pas les prolonger.
   */
  const askThenSave = async (sequence: SequenceView) => {
    const before = savedSteps[sequence.id] ?? 0;
    if (sequence.id === "" || sequence.steps.length <= before) {
      await save(sequence);
      return;
    }

    setBusy(true);
    setError(null);
    setDone(null);
    const plan = await requestJson(
      "/api/sequences-email/reopen",
      {
        method: "POST",
        body: JSON.stringify({
          sequenceId: sequence.id,
          steps: sequence.steps.map((step) => ({ delayDays: step.delayDays })),
        }),
      },
      isReopenPlan,
    );
    setBusy(false);

    if (!plan.ok) {
      setError(plan.message);
      return;
    }
    /*
      **Zéro rouverture ne s'enregistre plus en silence.** C'était le vrai
      défaut du jalon 81 : ajouter une étape à une campagne pleine de gens qui
      avaient terminé rendait la main sans un mot, et rien ne disait si la
      règle était trop étroite ou si la base ne portait pas ce qu'on croyait.
      L'écran montre donc ce qui est écrit en base, et c'est le seul geste qui
      permette de trancher depuis la production.
    */
    setConfirm({
      sequence,
      message: plan.data.message,
      exclusions: plan.data.exclusions,
      silence: plan.data.silence,
    });
  };

  const create = () =>
    setSequences((current) => [
      ...current,
      {
        id: "",
        name: "Nouvelle séquence",
        active: false,
        autoMode: false,
        steps: [{ position: 1, delayDays: 0, brief: "" }],
        enrolled: 0,
        running: 0,
        unlock: { unlocked: false, validated: 0, replies: 0, reason: "" },
      },
    ]);

  return (
    <div className="space-y-4">
      {!embedded && <p className="text-[12.5px] text-muted">
        Ces séquences <b className="font-semibold text-ink">envoient des emails</b> — à ne pas
        confondre avec les séquences de tâches plus bas, qui créent des rappels à faire à la
        main. Trois étapes au maximum : une séquence qui s'arrête d'elle-même limite les dégâts
        d'une réponse non repérée mieux que n'importe quel mécanisme.
      </p>}

      {sequences.map((sequence) => (
        <section
          key={sequence.id === "" ? "new" : sequence.id}
          className="rounded-card border border-line bg-surface-2 p-3.5"
        >
          {/*
            **Embarqué, le panneau ne porte que les étapes.** Le nom de la
            séquence est celui de la campagne, et son activation est le bouton
            « Lancer » de l'en-tête : deux contrôles pour une même chose, à deux
            endroits du même écran, finissent par se contredire — et l'on ne
            sait plus lequel a décidé.
          */}
          {!embedded && (
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <input
                className={FIELD}
                value={sequence.name}
                onChange={(event) => patch(sequence.id, { name: event.target.value })}
              />
              <label className="flex items-center gap-1.5 text-[12.5px]">
                <input
                  type="checkbox"
                  checked={sequence.active}
                  onChange={(event) => patch(sequence.id, { active: event.target.checked })}
                />
                Active
              </label>
              <span className="self-center text-[12px] text-muted">
                {sequence.running} en cours · {sequence.enrolled} inscrits
              </span>
            </div>
          )}

          {/*
            La frise vit dans son propre composant : les deux écrans qui
            montrent des étapes — la campagne et /reglages — passent par lui,
            et une seconde mise en forme finirait par ne plus dire le même
            rythme que la première.
          */}
          <SequenceSteps
            steps={sequence.steps}
            onChange={(steps) => patch(sequence.id, { steps })}
          />

          <div className="mt-3 rounded-control border border-line bg-surface px-3 py-2">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={sequence.autoMode}
                disabled={!sequence.unlock.unlocked}
                onChange={(event) => patch(sequence.id, { autoMode: event.target.checked })}
              />
              <span className="text-[12.5px]">
                <b className="font-semibold">Mode automatique</b> — les étapes 2 et 3 partent
                sans validation.{" "}
                <span className="text-muted">
                  La première étape passe toujours par vous : un premier message froid engage la
                  réputation du domaine.
                </span>
                <span className="mt-0.5 block text-[11.5px] text-muted">
                  {sequence.unlock.unlocked
                    ? `Déverrouillé : ${sequence.unlock.validated} départs validés à la main (${AUTO_MIN_VALIDATED} requis) et ${sequence.unlock.replies} réponse(s) obtenue(s).`
                    : `Verrouillé. ${sequence.unlock.reason}`}
                </span>
              </span>
            </label>
          </div>

          <button
            type="button"
            className={`${BUTTON} mt-3 bg-brand text-white hover:bg-brand-d`}
            disabled={busy}
            onClick={() => void askThenSave(sequence)}
          >
            Enregistrer
          </button>

          {confirm !== null && confirm.sequence.id === sequence.id && (
            <div className="mt-3 rounded-card border border-brand-lift bg-brand-l p-3 text-[12.5px]">
              <p className="font-semibold text-ink">
                {confirm.silence === "" ? confirm.message : "Aucune inscription ne sera rouverte."}
              </p>
              {confirm.silence === "" ? (
                <p className="mt-1 text-muted">
                  Le délai court depuis leur dernier message, pas depuis maintenant. Rien ne part
                  sans validation : les personnes dues entrent dans la prochaine composition.
                </p>
              ) : (
                <p className="mt-1 text-muted">{confirm.silence}</p>
              )}
              {confirm.exclusions !== "" && (
                <p className="mt-1 text-muted">{confirm.exclusions}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {confirm.silence === "" && (
                  <button
                    type="button"
                    disabled={busy}
                    className={`${BUTTON} bg-brand text-white hover:bg-brand-d`}
                    onClick={() => void save(confirm.sequence, true)}
                  >
                    Enregistrer et relancer
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  className={`${BUTTON} border border-line bg-surface hover:bg-surface-2`}
                  onClick={() => void save(confirm.sequence)}
                >
                  {confirm.silence === "" ? "Enregistrer sans relancer" : "Enregistrer"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className={`${BUTTON} border border-line bg-surface hover:bg-surface-2`}
                  onClick={() => setConfirm(null)}
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </section>
      ))}

      {error !== null && (
        <p className="rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
          {error}
        </p>
      )}
      {done !== null && (
        <p className="rounded-control border border-[#BEE3DA] bg-win-l px-3 py-2 text-[12.5px] text-win-d">
          {done}
        </p>
      )}

      {!embedded && (
        <button
          type="button"
          className={`${BUTTON} border border-line hover:bg-surface-2`}
          onClick={create}
        >
          Nouvelle séquence d'emails
        </button>
      )}
    </div>
  );
}
