import { notFound } from "next/navigation";
import { ContactsScreen } from "../../contacts/screen";
import { readContactList } from "@/lib/api/contact-lists";

export const dynamic = "force-dynamic";

/**
 * La page d'une liste : **le tableau de /contacts**, borné à ses membres.
 *
 * Elle ne rend pas une seconde vue — elle appelle l'écran de /contacts avec une
 * portée. Colonnes, sélecteur de colonnes, tri, filtres, tiroir de fiche et
 * sélection à la case sont donc exactement ceux qu'on utilise déjà, sans qu'il
 * ait fallu les réécrire ni qu'ils puissent diverger.
 */
export default async function ListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const list = await readContactList(id);
  if (list === null) notFound();

  return (
    <ContactsScreen
      raw={await searchParams}
      listScope={{ id: list.id, name: list.name }}
    />
  );
}
