import { CampaignsView } from "@/components/campaigns/campaigns-view";
import { listCampaigns } from "@/lib/api/campaigns";
import { listSequences } from "@/lib/api/email-sequences";
import { listMailboxes } from "@/lib/api/mailboxes";

export const dynamic = "force-dynamic";

/**
 * `/campagnes` — tout ce qui touche aux campagnes, au même endroit.
 *
 * La page est un composant serveur qui lit et passe : les décisions vivent
 * dans `lib/api/campaigns.ts`, l'édition des étapes dans l'éditeur du jalon 38
 * monté par carte, et la sélection des contacts sur /contacts — d'où l'on
 * revient inscrire.
 */
export default async function CampagnesPage() {
  const [campaigns, sequences, mailboxes] = await Promise.all([
    listCampaigns(),
    listSequences(),
    listMailboxes(),
  ]);

  return (
    <CampaignsView
      initial={campaigns}
      sequences={sequences.map((sequence) => ({
        ...sequence,
        steps: [...sequence.steps],
        unlock: { ...sequence.unlock },
      }))}
      mailboxes={mailboxes.map((box) => ({
        id: box.id,
        label: box.label,
        signName: box.signName,
      }))}
    />
  );
}
