import { Eyebrow } from "@/components/ui/primitives";
import { formatRate } from "@/lib/domain/email-stats";
import { describeLift, type DmLift } from "@/lib/domain/dm-lift";

/**
 * « Le DM avant l'email change-t-il quelque chose ? »
 *
 * Un seul composant pour `/emails` et `/performance` : deux rendus du même
 * chiffre finiraient par ne plus dire la même chose, et c'est précisément le
 * chiffre sur lequel une décision de stratégie va s'appuyer.
 *
 * La phrase de lecture vient du domaine et **refuse de conclure** tant que les
 * groupes sont trop petits. C'est la même discipline que la mise en garde du
 * taux d'ouverture au jalon 43 : un nombre s'affiche avec ce qu'il vaut, ou ne
 * s'affiche pas.
 */
export function DmLiftBlock({ lift }: { readonly lift: DmLift }) {
  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card">
      <h2 className="mb-1 font-display text-sm font-semibold">
        DM puis email, ou email seul
      </h2>
      <p className="mb-3 text-[12px] leading-relaxed text-muted">{describeLift(lift)}</p>

      <div className="grid gap-3 *:min-w-0 sm:grid-cols-2">
        <Side
          label="Avec un DM avant"
          people={lift.withDm.people}
          replies={lift.withDm.replies}
          rate={formatRate(lift.withDm.rate)}
          strong
        />
        <Side
          label="Sans DM"
          people={lift.withoutDm.people}
          replies={lift.withoutDm.replies}
          rate={formatRate(lift.withoutDm.rate)}
        />
      </div>

      {lift.delayDays !== null && (
        <p className="mt-3 text-[12px] text-muted">
          Délai médian entre le DM et la réponse :{" "}
          <b className="font-mono font-semibold text-ink tabular-nums">
            {lift.delayDays} j
          </b>
        </p>
      )}
    </section>
  );
}

function Side({
  label,
  people,
  replies,
  rate,
  strong = false,
}: {
  readonly label: string;
  readonly people: number;
  readonly replies: number;
  readonly rate: string;
  readonly strong?: boolean;
}) {
  return (
    <div
      className={`rounded-control border px-3.5 py-3 ${
        strong ? "border-brand-lift bg-brand-l" : "border-line bg-surface-2"
      }`}
    >
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{rate}</div>
      {/* Le dénominateur est **écrit**, jamais sous-entendu : « 60 % » sur cinq
          personnes et sur cinq cents ne se lisent pas de la même façon. */}
      <div className="mt-0.5 text-[12px] text-muted">
        {replies} réponse{replies > 1 ? "s" : ""} sur {people} personne
        {people > 1 ? "s" : ""} écrite{people > 1 ? "s" : ""}
      </div>
    </div>
  );
}
