"use client";

import { useState } from "react";

/**
 * Saisie du mot de passe partagé.
 *
 * Le mot de passe part en POST JSON et ne transite jamais par l'URL — un
 * paramètre de requête finirait dans l'historique du navigateur et dans les
 * journaux d'accès du proxy.
 *
 * La redirection utilise `window.location` plutôt que le routeur : le cookie
 * vient d'être posé par la réponse, et seule une navigation complète garantit
 * que le middleware le voie au prochain rendu serveur.
 */
export function LoginForm({ next }: { next: string }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    let response: Response;
    try {
      response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
    } catch {
      setBusy(false);
      setError("Le serveur est injoignable. Vérifiez votre connexion.");
      return;
    }

    if (response.ok) {
      window.location.assign(next);
      return;
    }

    const payload: unknown = await response.json().catch(() => null);
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof (payload as { error: { message?: unknown } }).error?.message === "string"
        ? (payload as { error: { message: string } }).error.message
        : `Erreur serveur (${response.status}).`;

    setBusy(false);
    setPassword("");
    setError(message);
  };

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="grid gap-3 rounded-card border border-line bg-surface p-4 shadow-card"
    >
      <label className="block">
        <span className="mb-1 block font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
          Mot de passe
        </span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-control border border-line bg-surface px-2.5 py-2 text-[13.5px] outline-none focus:border-flux"
        />
      </label>

      {error !== null && (
        <p className="rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || password === ""}
        className="rounded-control bg-flux px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-flux-d disabled:opacity-50"
      >
        {busy ? "Vérification…" : "Entrer"}
      </button>
    </form>
  );
}
