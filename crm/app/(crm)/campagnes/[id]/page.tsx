import Link from "next/link";
import { notFound } from "next/navigation";
import { CampaignDetail } from "@/components/campaigns/campaign-detail";
import {
  listCampaigns,
  listCampaignMembers,
  readCampaignGroups,
} from "@/lib/api/campaigns";
import { listSequences } from "@/lib/api/email-sequences";
import { listMailboxes } from "@/lib/api/mailboxes";
import { mailboxOptions } from "@/lib/api/mailbox-options";
import { missingValueReports } from "@/lib/api/manual-step";

export const dynamic = "force-dynamic";

/**
 * `/campagnes/[id]` — une campagne, en entier.
 *
 * C'est ici que vit tout ce que la vignette ne porte pas : les étapes, les
 * inscrits avec leur avancement, l'entonnoir et les départs. Les inscrits sont
 * lus **ici**, côté serveur, et seulement pour cette campagne — la liste ne
 * coûte plus une requête par campagne du CRM comme lorsque tout tenait sur un
 * seul écran.
 */
export default async function CampagnePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // `listCampaigns` porte déjà l'entonnoir et le verdict de suppression, et
  // c'est elle que les routes renvoient après chaque écriture : lire la
  // campagne autrement ferait une seconde source pour les mêmes nombres.
  const [campaigns, mailboxes] = await Promise.all([listCampaigns(), listMailboxes()]);
  const campaign = campaigns.find((entry) => entry.id === id);
  if (campaign === undefined) notFound();

  const [sequences, members, groups] = await Promise.all([
    listSequences(),
    listCampaignMembers(campaign.sequenceId),
    readCampaignGroups(campaign.sequenceId),
  ]);
  const sequence = sequences.find((entry) => entry.id === campaign.sequenceId) ?? null;

  /*
    **Les destinataires dont une valeur manque, avant tout envoi.**

    Le retrait de phrase (jalon 87) reste la règle ; ce qui change, c'est qu'il
    s'annonce. On lit ici **tous** les gabarits écrits à la main de la séquence,
    variantes comprises : une balise qui ne vit que dans la variante Direction
    concerne les seuls contacts de ce groupe, mais elle retirera bien une phrase.
  */
  const templates =
    sequence === null
      ? []
      : sequence.steps
          .filter((step) => step.mode === "manual")
          .flatMap((step) => [
            step.subject,
            step.body,
            ...step.variants.flatMap((variant) => [variant.subject, variant.body]),
          ])
          .filter((text) => text.trim() !== "");
  const missing =
    templates.length === 0 ? [] : await missingValueReports(campaign.sequenceId, templates);

  return (
    <div className="px-6 py-6">
      <Link href="/campagnes" className="text-[12.5px] text-brand-d hover:underline">
        ← Toutes les campagnes
      </Link>
      <CampaignDetail
        campaign={campaign}
        sequence={
          sequence === null
            ? null
            : { ...sequence, steps: [...sequence.steps], unlock: { ...sequence.unlock } }
        }
        members={members}
        groups={groups}
        missing={missing}
        mailboxes={mailboxOptions(mailboxes)}
      />
    </div>
  );
}
