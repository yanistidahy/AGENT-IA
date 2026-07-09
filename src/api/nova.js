const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export async function validateInstagram(username, password) {
  const res = await fetch(`${BACKEND_URL}/api/validate-account`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`Erreur serveur: ${res.status}`);
  return res.json();
}

export async function scrapeProspects({ comptes, username, password, filters = {} }) {
  const res = await fetch(`${BACKEND_URL}/api/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      comptes,
      instagram_username: username,
      instagram_password: password,
      max_par_compte: 100,
      min_followers: filters.minAbonnes ?? 1000,
      max_followers: filters.maxAbonnes ?? 100000,
      require_link: filters.boutique ?? false,
      require_founder_bio: filters.fondateur ?? false,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Erreur serveur: ${res.status}`);
  }
  return res.json();
}

export function getStoredCredentials() {
  try {
    const raw = sessionStorage.getItem("nova_ig_creds");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCredentials(username, password) {
  sessionStorage.setItem("nova_ig_creds", JSON.stringify({ username, password }));
}

export function clearCredentials() {
  sessionStorage.removeItem("nova_ig_creds");
}
