import { CampaignsView } from "@/components/campaigns/campaigns-view";
import { listCampaigns, listCampaignMembers } from "@/lib/api/campaigns";
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

  /*
    Les inscrits sont lus **ici**, côté serveur, une requête par campagne : la
    liste n'existe qu'au dépli, mais la charger au clic demanderait une route de
    plus et un état de chargement pour une lecture qui tient dans le même
    aller-retour. `onRefresh` (un `router.refresh()`) rejoue cette page : après
    un retrait, c'est le serveur qui redit qui reste, pas le navigateur qui
    devine.
  */
  const members = Object.fromEntries(
    await Promise.all(
      campaigns.map(
        async (campaign) =>
          [campaign.id, await listCampaignMembers(campaign.sequenceId)] as const,
      ),
    ),
  );

  return (
    <CampaignsView
      initial={campaigns}
      members={members}
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
