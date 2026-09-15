import Link from "next/link";
import { notFound } from "next/navigation";
import { CampaignDetail } from "@/components/campaigns/campaign-detail";
import { listCampaigns, listCampaignMembers } from "@/lib/api/campaigns";
import { listSequences } from "@/lib/api/email-sequences";
import { listMailboxes } from "@/lib/api/mailboxes";
import { mailboxOptions } from "@/lib/api/mailbox-options";

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

  const [sequences, members] = await Promise.all([
    listSequences(),
    listCampaignMembers(campaign.sequenceId),
  ]);
  const sequence = sequences.find((entry) => entry.id === campaign.sequenceId) ?? null;

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
        mailboxes={mailboxOptions(mailboxes)}
      />
    </div>
  );
}
