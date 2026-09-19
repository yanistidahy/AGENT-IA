import { ContactsScreen } from "./screen";

export const dynamic = "force-dynamic";

/** `/contacts` : l'écran sans portée de liste. */
export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ContactsScreen raw={await searchParams} />;
}
