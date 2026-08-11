import Link from "next/link";
import { Mark } from "@/components/brand/logo";
import { Icon } from "@/components/ui/icon";

export const dynamic = "force-dynamic";

/**
 * Coquille du conseil d'agents : thème sombre, plein écran.
 *
 * Volontairement hors du groupe `(crm)` — on doit sentir qu'on passe du tableau
 * de bord à la salle de réunion. Le lien de retour reste visible pour que la
 * bascule ne soit jamais un cul-de-sac.
 */
export default function ConseilLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0B0E1A] text-[#CBD2E8]">
      <header className="flex flex-none items-center gap-3 border-b border-[#1E2430] px-5 py-3">
        <span className="text-white">
          <Mark size={26} />
        </span>
        <div>
          <div className="font-display text-[14px] font-bold tracking-tight text-white">
            Alfred &amp; Associés
          </div>
          <div className="font-mono text-[9px] tracking-[0.14em] text-violet uppercase">
            Conseil d&apos;agents
          </div>
        </div>
        <Link
          href="/"
          className="ml-auto inline-flex items-center gap-1.5 rounded-control border border-[#2A3240] px-2.5 py-1.5 text-[12.5px] text-[#9AA4CE] transition-colors hover:border-[#3D4759] hover:text-white"
        >
          <Icon name="dash" size={14} />
          Retour au CRM
        </Link>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
