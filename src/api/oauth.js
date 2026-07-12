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

/* ── Google OAuth (implicit flow via popup) ───────────────────────────────── */
const GOOGLE_SCOPES = {
  gmail: [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
  ],
  sheets: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
  ],
  calendar: [
    "https://www.googleapis.com/auth/calendar.readonly",
  ],
};

function openPopup(url) {
  const w = 520, h = 640;
  const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - h) / 2);
  return window.open(
    url,
    "aura_oauth",
    `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`
  );
}

export function connectGoogle(serviceId) {
  return new Promise((resolve, reject) => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      reject(new Error("VITE_GOOGLE_CLIENT_ID non configuré — ajoutez-le dans votre fichier .env"));
      return;
    }

    const scopes = GOOGLE_SCOPES[serviceId];
    if (!scopes) {
      reject(new Error(`Service inconnu : ${serviceId}`));
      return;
    }

    const redirectUri = `${window.location.origin}/oauth/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "token",
      scope: scopes.join(" "),
      state: `${serviceId}:${Date.now()}`,
      prompt: "select_account",
    });

    const popup = openPopup(
      `https://accounts.google.com/o/oauth2/v2/auth?${params}`
    );

    if (!popup || popup.closed) {
      reject(new Error("Popup bloqué — autorisez les popups pour ce site dans votre navigateur."));
      return;
    }

    const onMessage = (evt) => {
      if (evt.origin !== window.location.origin) return;
      if (evt.data?.type !== "oauth_callback") return;
      cleanup();
      if (evt.data.error) {
        reject(new Error(evt.data.error === "access_denied" ? "Accès refusé par l'utilisateur" : evt.data.error));
      } else {
        resolve(evt.data);
      }
    };

    const pollClosed = setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error("cancelled"));
      }
    }, 600);

    function cleanup() {
      clearInterval(pollClosed);
      window.removeEventListener("message", onMessage);
    }

    window.addEventListener("message", onMessage);
  });
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
