import { createFrontendClient } from "@pipedream/sdk/browser";

const pd = createFrontendClient();

export const connectGoogleSheets = async () => {
  await pd.connectAccount({
    app: "google_sheets",
    onSuccess: ({ id }) => {
      localStorage.setItem("pipedream_sheets_id", id);
      console.log("Google Sheets connecté :", id);
    },
  });
};

export const connectGmail = async () => {
  await pd.connectAccount({
    app: "gmail",
    onSuccess: ({ id }) => {
      localStorage.setItem("pipedream_gmail_id", id);
      console.log("Gmail connecté :", id);
    },
  });
};
