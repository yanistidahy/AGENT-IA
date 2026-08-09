const STORAGE_KEY = "aura_integrations";

/* ── Persistence ──────────────────────────────────────────────────────────── */
export function getConnections() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveConnection(serviceId, data) {
  const all = getConnections();
  all[serviceId] = { ...data, connected: true, connectedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function removeConnection(serviceId) {
  const all = getConnections();
  delete all[serviceId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function getConnection(serviceId) {
  return getConnections()[serviceId] || null;
}

/* ── SMTP test (via Python backend) ──────────────────────────────────────── */
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export async function testSmtp({ host, port, email, password }) {
  const res = await fetch(`${BACKEND_URL}/api/test-smtp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ host, port: Number(port), email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Erreur serveur : ${res.status}`);
  }
  return res.json();
}
