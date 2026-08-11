"use client";

/**
 * Fermeture de session depuis le rail.
 *
 * `window.location` plutôt que le routeur : le cookie vient d'être effacé côté
 * serveur, et seule une navigation complète empêche le client de continuer à
 * afficher des écrans rendus avec l'ancienne session.
 */
export function LogoutButton() {
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.assign("/login");
  };

  return (
    <button
      type="button"
      onClick={() => void logout()}
      className="mt-2 block text-rail-dim hover:text-rail-text text-[11.5px] underline transition-colors"
    >
      Fermer la session
    </button>
  );
}
