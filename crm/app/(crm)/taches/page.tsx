import { TaskBanners } from "@/components/tasks/task-banners";
import { TasksView } from "@/components/tasks/tasks-view";
import { listOwners } from "@/lib/api/reference";
import { readTaskScreen } from "@/lib/api/task-feed";
import { listTaskTabs } from "@/lib/api/task-tabs";
import { prisma } from "@/lib/db";
import { contactTitle } from "@/lib/domain/contact-identity";
import { foldSearch } from "@/lib/domain/task-tabs";
import { DEFAULT_TAB, isTaskTabId, type TaskTabId } from "@/lib/domain/task-tabs";

export const dynamic = "force-dynamic";

/**
 * L'écran Tâches, rangé en quatre onglets.
 *
 * **Une seule nature d'objet.** La file ne porte plus que des tâches ; les
 * départs en attente, les réponses à traiter et les prospects chauds — trois
 * onglets du jalon 92 — sont devenus trois bandeaux, chacun menant là où le
 * travail se fait. Trois natures différentes dans une même rangée demandaient de
 * se rappeler, onglet par onglet, ce qu'on pouvait faire de ce qu'on y lisait.
 *
 * **Les bandeaux sont rendus côté serveur** : trois liens et trois nombres n'ont
 * aucun état, donc aucun JavaScript n'a à partir pour eux.
 *
 * **L'onglet, la personne et les filtres vivent dans l'URL** : la vue se met en
 * favori, se partage et survit à un rechargement — règle du jalon 1, et c'est
 * aussi ce qui permet à un onglet enregistré de n'être qu'une requête nommée.
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

  const [screen, owners, savedTabs, contacts] = await Promise.all([
    readTaskScreen(),
    listOwners(),
    listTaskTabs(),
    prisma.contact.findMany({
      select: { id: true, firstName: true, lastName: true, company: { select: { name: true } } },
      orderBy: { nameKey: "asc" },
      take: 500,
    }),
  ]);

  /*
    Les personnes proposées : **celles de la donnée**, réunies aux propriétaires
    de référence. Une liste écrite en dur afficherait Mohamed après son départ et
    manquerait la troisième personne le jour où elle arrive.
  */
  const people = [...new Set([...owners, ...screen.people])];

  return (
    <div className="px-6 py-6">
      <header className="mb-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Tâches</h1>
      </header>

      <TaskBanners counts={screen.banners} />

      <TasksView
        rows={screen.rows}
        tab={tab}
        savedTabs={savedTabs}
        people={people}
        contacts={contacts.map((contact) => ({
          id: contact.id,
          label:
            contact.company === null
              ? contactTitle(contact)
              : `${contactTitle(contact)} · ${contact.company.name}`,
          // La clé de recherche est pliée **ici**, une fois : la frappe dans le
          // champ n'a plus qu'à comparer (accents et casse absorbés, jalon 72).
          search: foldSearch(
            `${contactTitle(contact)} ${contact.company?.name ?? ""}`,
          ),
        }))}
      />
    </div>
  );
}
