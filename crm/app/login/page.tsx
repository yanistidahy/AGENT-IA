import { LoginForm } from "@/components/auth/login-form";
import { safeNext } from "@/lib/auth/redirect";

export const dynamic = "force-dynamic";

export const metadata = { title: "AuraFLOW — Connexion" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const next = Array.isArray(raw.next) ? raw.next[0] : raw.next;

  return (
    <main className="grid min-h-screen place-items-center bg-surface-2 px-6">
      <div className="w-full max-w-[380px]">
        <h1 className="font-display text-2xl font-semibold tracking-tight">AuraFLOW</h1>
        <p className="mt-1 mb-5 text-[13px] text-muted">
          Espace de travail privé. Saisissez le mot de passe partagé pour continuer.
        </p>
        <LoginForm next={safeNext(next)} />
      </div>
    </main>
  );
}
