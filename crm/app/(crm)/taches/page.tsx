import { TasksView } from "@/components/tasks/tasks-view";
import { listOwners } from "@/lib/api/reference";
import { readTaskFeed } from "@/lib/api/task-feed";
import { listTaskTabs } from "@/lib/api/task-tabs";
import { prisma } from "@/lib/db";
import { contactTitle } from "@/lib/domain/contact-identity";
import { DEFAULT_TAB, isTaskTabId, type TaskTabId } from "@/lib/domain/task-tabs";

export const dynamic = "force-dynamic";

/**
 * L'écran Tâches, rangé en onglets.
 *
 * **Une seule lecture, six prédicats.** `readTaskFeed()` assemble toutes les
 * lignes — tâches, départs en attente, réponses relevées, signaux d'intérêt — et
 * les onglets ne sont que des questions posées à ce tableau (`TAB_PREDICATES`,
 * `lib/domain/task-tabs.ts`). Rien n'est écrit en base pour alimenter un onglet.
 *
 * **L'onglet et les filtres vivent dans l'URL** : la vue se met en favori, se
 * partage et survit à un rechargement — règle du jalon 1, et c'est aussi ce qui
 * permet à un onglet enregistré de n'être qu'une requête nommée.
 */
export default async function TachesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) flat[key] = first;
  }

  const wanted = flat["onglet"] ?? "";
  const tab: TaskTabId = isTaskTabId(wanted) ? wanted : DEFAULT_TAB;

  const [feed, owners, savedTabs, contacts, companies, deals] = await Promise.all([
    readTaskFeed(),
    listOwners(),
    listTaskTabs(),
    prisma.contact.findMany({
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.deal.findMany({
      where: { status: "open" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <TasksView
      rows={feed.rows}
      tab={tab}
      savedTabs={savedTabs}
      owners={[...new Set([...owners, ...feed.owners])]}
      targets={{
        contacts: contacts.map((c) => ({ id: c.id, label: contactTitle(c) })),
        companies: companies.map((c) => ({ id: c.id, label: c.name })),
        deals: deals.map((d) => ({ id: d.id, label: d.name })),
      }}
    />
  );
}
