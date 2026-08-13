import Link from "next/link";
import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import { listRecommendations } from "@/lib/api/recommendations";
import { SEVERITIES, SEVERITY_LABELS, isSeverity } from "@/lib/domain/recommendations";
import { SHIFTS } from "@/lib/agents/shifts/run";

export const dynamic = "force-dynamic";

/**
 * Toutes les recommandations, ouvertes comme décidées.
 *
 * L'historique des décisions n'est pas décoratif : c'est lui qui dira, dans
 * quelques semaines, quels constats sont systématiquement écartés — et donc
 * quels prompts revoir.
 */
export default async function SuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat = (key: string): string | undefined => {
    const value = raw[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const agent = flat("agent");
  const severity = flat("severity");
  const scope = flat("scope") === "decided" ? "decided" : "open";

  const items = await listRecommendations({
    agentId: agent,
    severity: severity !== undefined && isSeverity(severity) ? severity : undefined,
    scope,
  });

  const chip = (label: string, href: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      className={`rounded-control border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
        active ? "border-brand bg-brand text-white" : "border-line bg-surface hover:bg-surface-2"
      }`}
    >
      {label}
    </Link>
  );

  const base = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { agent, severity, scope, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value !== undefined && value !== "") params.set(key, value);
    }
    return `/conseil/suggestions?${params.toString()}`;
  };

  return (
    <div className="px-6 py-6">
      <header className="mb-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Suggestions</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          Ce que les agents ont relevé pendant leurs vacations. Rien n'est écrit sans votre clic.
        </p>
      </header>

      <div className="mb-3.5 flex flex-wrap gap-2">
        {chip("À décider", base({ scope: "open" }), scope === "open")}
        {chip("Historique", base({ scope: "decided" }), scope === "decided")}
        <span className="w-4" />
        {chip("Tous les agents", base({ agent: undefined }), agent === undefined)}
        {SHIFTS.map((shift) =>
          chip(shift.agentId, base({ agent: shift.agentId }), agent === shift.agentId),
        )}
        <span className="w-4" />
        {chip("Toutes gravités", base({ severity: undefined }), severity === undefined)}
        {SEVERITIES.map((value) =>
          chip(SEVERITY_LABELS[value], base({ severity: value }), severity === value),
        )}
      </div>

      {items.length === 0 ? (
        <p className="rounded-card border border-dashed border-line px-3.5 py-6 text-center text-[12.5px] text-muted">
          {scope === "open"
            ? "Aucune recommandation en attente. C'est une sortie valide : les agents ne produisent rien quand ils n'ont rien à dire."
            : "Aucune décision enregistrée pour l'instant."}
        </p>
      ) : (
        <ul className="grid gap-2">
          {items.map((item) => (
            <RecommendationCard key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
