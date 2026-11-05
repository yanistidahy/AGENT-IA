import Link from "next/link";
import { readEmailHealth } from "@/lib/api/email-stats";
import { parseSentQuery, readSentEmails, readSilentContacts } from "@/lib/api/email-list";
import { listOwners } from "@/lib/api/reference";
import { SentTable } from "@/components/emails/sent-table";
import { NoReplyBlock } from "@/components/emails/no-reply-block";

export const dynamic = "force-dynamic";

/**
 * La section « Emails » — le journal, et la file de travail.
 *
 * **Ce que ce jalon a retiré, et pourquoi.** La page portait un entonnoir, un
 * taux d'ouverture avec ses deux avertissements, la comparaison DM + email, un
 * tableau par signataire et deux graphiques. C'étaient des mesures, et les
 * mesures vivent désormais à un seul endroit : `/pilotage`, qui les lit dans le
 * journal des événements de prospection. Deux écrans qui comptent les mêmes
 * envois finissent par afficher deux nombres, et c'est l'écart que ce jalon
 * ferme.
 *
 * Il reste les deux raisons d'ouvrir cette page, et elles ne sont pas des
 * mesures : **ce qui est parti** (le journal, filtrable et trié) et **qui n'a
 * pas encore répondu** (la file de relance, qui écrit). Plus le bandeau des
 * copies IMAP ratées : un message parti sans copie dans « Envoyés » est un fait
 * opérationnel à réparer, pas un indicateur.
 *
 * Composant serveur de bout en bout, sauf le bloc « sans réponse » — il écrit.
 */
export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseSentQuery(await searchParams);

  const [health, list, silent, owners] = await Promise.all([
    readEmailHealth(),
    readSentEmails(query),
    readSilentContacts(),
    listOwners(),
  ]);

  if (health.total === 0) {
    return (
      <div className="px-6 py-5">
        <Header windowDays={health.windowDays} />
        <section className="rounded-card border border-line bg-surface px-4 py-6">
          <h2 className="font-display text-[15px] font-semibold">Aucun email envoyé</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            Aucun message n'est parti depuis ce CRM sur les {health.windowDays} derniers jours.
            Ce n'est pas un résultat : il n'y a rien à compter.
          </p>
          <Link
            href="/contacts"
            className="mt-3 inline-flex rounded-control bg-brand px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-d"
          >
            Ouvrir une fiche et rédiger un email
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="px-6 py-5">
      <Header windowDays={health.windowDays} total={health.total} />

      {health.copyFailures > 0 && (
        <p className="mb-4 rounded-control border border-[#F0DFB8] bg-gold-l px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[#9A6410]">
          <strong>
            {health.copyFailures} message{health.copyFailures > 1 ? "s" : ""} n'
            {health.copyFailures > 1 ? "ont" : "a"} pas été copié
            {health.copyFailures > 1 ? "s" : ""} dans « Envoyés ».
          </strong>{" "}
          Ils sont bien partis — seule la copie IMAP a échoué. La cause figure dans Réglages →
          Messagerie.
        </p>
      )}

      {/* Le journal et la file de travail côte à côte : on lit ce qui est parti
          à gauche, on agit à droite, sans changer d'écran ni perdre le tri. */}
      <section className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SentTable list={list} query={query} />
        <NoReplyBlock rows={silent} owners={owners} defaultOwner={owners[0] ?? ""} />
      </section>

      <p className="text-[12.5px] text-muted">
        Les chiffres — messages, réponses, taux, démos — sont sur{" "}
        <Link href="/pilotage" className="underline hover:text-brand-d">
          Pilotage
        </Link>
        , qui les lit dans le journal des événements de prospection.
      </p>
    </div>
  );
}

function Header({ windowDays, total }: { readonly windowDays: number; readonly total?: number }) {
  return (
    <header className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h1 className="font-display text-xl font-semibold tracking-tight">Emails</h1>
      <p className="text-[12.5px] text-muted">
        Ce qui est parti depuis ce CRM sur les {windowDays} derniers jours, et qui n'a pas encore
        répondu.
        {total !== undefined && total > 0 && (
          <>
            {" "}
            <span className="tabular-nums">{total}</span> message{total > 1 ? "s" : ""} au journal.
          </>
        )}
      </p>
    </header>
  );
}
