import { createFrontendClient } from "@pipedream/sdk/browser";

const pd = createFrontendClient({
  projectId: import.meta.env.VITE_PIPEDREAM_PROJECT_ID || "proj_jBsEq4e",
  environment: "production",
});

export const connectGoogleSheets = async (onSuccess) => {
  const result = await pd.connectAccount({
    app: "google_sheets",
    onSuccess: (account) => {
      localStorage.setItem("pipedream_sheets_token", account.id);
      if (onSuccess) onSuccess(account);
    },
  });
  return result;
};

export const connectGmail = async (onSuccess) => {
  const result = await pd.connectAccount({
    app: "gmail",
    onSuccess: (account) => {
      localStorage.setItem("pipedream_gmail_token", account.id);
      if (onSuccess) onSuccess(account);
    },
  });
  return result;
};

export const connectGoogleCalendar = async (onSuccess) => {
  const result = await pd.connectAccount({
    app: "google_calendar",
    onSuccess: (account) => {
      localStorage.setItem("pipedream_calendar_token", account.id);
      if (onSuccess) onSuccess(account);
    },
  });
  return result;
};

export const isConnected = (service) => {
  return !!localStorage.getItem(`pipedream_${service}_token`);
};
