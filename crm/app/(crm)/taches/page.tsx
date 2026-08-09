import type { TaskView } from "@/components/activities/types";
import { TasksView } from "@/components/tasks/tasks-view";
import { listOwners } from "@/lib/api/reference";
import { parseTasksQuery } from "@/lib/api/task-schemas";
import { listTasks } from "@/lib/api/tasks";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TachesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    flat[key] = Array.isArray(value) ? value[0] : value;
  }

  const parsed = parseTasksQuery(flat);
  const query = parsed.success ? parsed.data : {};

  const [tasks, owners, contacts, companies, deals] = await Promise.all([
    listTasks({ scope: "open", ...query }),
    listOwners(),
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

  // `TaskView` porte des `Date` : la sérialisation serveur → client les conserve,
  // contrairement au JSON de l'API que `parseTask` doit reconvertir.
  const view: TaskView[] = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    due: task.due,
    priority: task.priority,
    owner: task.owner,
    done: task.done,
    target:
      task.target === null ? null : { label: task.target.label, href: task.target.href },
  }));

  return (
    <TasksView
      tasks={view}
      owners={owners}
      targets={{
        contacts: contacts.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName}` })),
        companies: companies.map((c) => ({ id: c.id, label: c.name })),
        deals: deals.map((d) => ({ id: d.id, label: d.name })),
      }}
    />
  );
}
