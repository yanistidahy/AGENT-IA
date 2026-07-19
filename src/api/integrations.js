const PIPEDREAM_BASE = import.meta.env.VITE_PIPEDREAM_URL;

function openPipedreamPopup(path, name) {
  const width = 500, height = 600;
  const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - height) / 2);
  return window.open(
    `${PIPEDREAM_BASE}${path}`,
    name,
    `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
  );
}

export function connectGoogleSheets() {
  if (!PIPEDREAM_BASE) {
    throw new Error("VITE_PIPEDREAM_URL non configuré — ajoutez-le dans votre fichier .env");
  }
  return new Promise((resolve, reject) => {
    const popup = openPipedreamPopup("/connect/google-sheets", "pipedream-connect");
    if (!popup || popup.closed) {
      reject(new Error("Popup bloqué — autorisez les popups pour ce site dans votre navigateur."));
      return;
    }
    const poll = setInterval(() => {
      if (popup.closed) {
        clearInterval(poll);
        resolve({ connected: true });
      }
    }, 600);
  });
}

export function connectGmail() {
  if (!PIPEDREAM_BASE) {
    throw new Error("VITE_PIPEDREAM_URL non configuré — ajoutez-le dans votre fichier .env");
  }
  return new Promise((resolve, reject) => {
    const popup = openPipedreamPopup("/connect/gmail", "pipedream-connect");
    if (!popup || popup.closed) {
      reject(new Error("Popup bloqué — autorisez les popups pour ce site dans votre navigateur."));
      return;
    }
    const poll = setInterval(() => {
      if (popup.closed) {
        clearInterval(poll);
        resolve({ connected: true });
      }
    }, 600);
  });
}

export async function readSheet(spreadsheetId, range) {
  const res = await fetch(`${PIPEDREAM_BASE}/api/sheets/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ spreadsheetId, range }),
  });
  if (!res.ok) throw new Error(`Erreur lecture sheet : ${res.status}`);
  return res.json();
}

export async function writeSheet(spreadsheetId, range, values) {
  const res = await fetch(`${PIPEDREAM_BASE}/api/sheets/write`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ spreadsheetId, range, values }),
  });
  if (!res.ok) throw new Error(`Erreur écriture sheet : ${res.status}`);
  return res.json();
}
