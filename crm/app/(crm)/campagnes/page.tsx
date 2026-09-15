import { CampaignsView } from "@/components/campaigns/campaigns-view";
import { listCampaigns } from "@/lib/api/campaigns";
import { listMailboxes } from "@/lib/api/mailboxes";
import { mailboxOptions } from "@/lib/api/mailbox-options";

export const dynamic = "force-dynamic";

/**
 * `/campagnes` — **la liste, et rien d'autre**.
 *
 * Une grille de vignettes : de quoi choisir une campagne, pas de quoi la
 * travailler. Tout ce qui se travaille — étapes, inscrits, entonnoir, départs —
 * vit dans `/campagnes/[id]`.
 *
 * La page ne lit plus les inscrits de chaque campagne. C'était une requête par
 * campagne pour une liste qui n'apparaît nulle part ici ; les trois nombres de
 * la vignette viennent de la même lecture que l'entonnoir, et la liste des
 * membres est chargée par la page qui la montre.
 */
export default async function CampagnesPage() {
  const [campaigns, mailboxes] = await Promise.all([listCampaigns(), listMailboxes()]);

  return <CampaignsView initial={campaigns} mailboxes={mailboxOptions(mailboxes)} />;
}
