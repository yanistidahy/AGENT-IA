import { listContactLists } from "@/lib/api/contact-lists";
import { ListsView } from "@/components/lists/lists-view";

export const dynamic = "force-dynamic";

/**
 * `/listes` : choisir une liste, ou en créer une.
 *
 * Deux niveaux, comme les campagnes depuis le jalon 71 : cette page sert à
 * **choisir**, la page d'une liste sert à **travailler**. Une grille qui
 * porterait déjà les fiches de chaque liste ferait défiler pour trouver la
 * suivante.
 */
export default async function ListsPage() {
  return <ListsView lists={await listContactLists()} />;
}
