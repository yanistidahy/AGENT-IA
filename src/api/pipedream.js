import { createFrontendClient } from "@pipedream/sdk/browser";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

const getToken = async () => {
  const res = await fetch(`${BACKEND}/api/pipedream/connect-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: "housni-aura-flow" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Erreur serveur : ${res.status}`);
  }
  const data = await res.json();
  return data.token;
};

export const connectApp = async (appSlug, onSuccess) => {
  const token = await getToken();
  const pd = createFrontendClient();
  pd.connectAccount({
    app: appSlug,
    token,
    onSuccess: (account) => {
      localStorage.setItem(`pd_${appSlug}`, account.id);
      onSuccess?.(account);
    },
    onError: (err) => {
      console.error("Pipedream Connect error:", err);
    },
  });
};

export const connectGoogleSheets = (cb) => connectApp("google_sheets", cb);
export const connectGmail = (cb) => connectApp("gmail", cb);
export const connectGoogleCalendar = (cb) => connectApp("google_calendar", cb);

export const isConnected = (slug) => !!localStorage.getItem(`pd_${slug}`);
