import { LoginForm } from "@/components/auth/login-form";
import { Wordmark } from "@/components/brand/logo";
import { safeNext } from "@/lib/auth/redirect";
import { readBrandLogo } from "@/lib/api/brand-logo";

export const dynamic = "force-dynamic";

export const metadata = { title: "Connexion" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const next = Array.isArray(raw.next) ? raw.next[0] : raw.next;
  // La route du logo est publique précisément pour cet écran : /login s'affiche
  // sans session, et un logo privé y laisserait un trou sur la page qui doit
  // justement dire où l'on arrive.
  const brand = await readBrandLogo().catch(() => null);

  return (
    <main className="grid min-h-screen place-items-center bg-surface-2 px-6">
      <div className="w-full max-w-[380px]">
        {/* La marque, pas un titre de niveau 1 en texte : c'est le premier
            écran, et c'est là qu'on reconnaît où l'on arrive. */}
        <h1 className="mb-4">
          <Wordmark tone="light" size={36} logo={brand} />
        </h1>
        <p className="mt-1 mb-5 text-[13px] text-muted">
          Espace de travail privé. Saisissez le mot de passe partagé pour continuer.
        </p>
        <LoginForm next={safeNext(next)} />
      </div>
    </main>
  );
}
