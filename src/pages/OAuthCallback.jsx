import { useEffect } from "react";

export default function OAuthCallback() {
  useEffect(() => {
    const fragment = window.location.hash.substring(1);
    const query = window.location.search.substring(1);
    const params = new URLSearchParams(fragment || query);

    const accessToken = params.get("access_token");
    const error = params.get("error");
    const errorDescription = params.get("error_description");
    const state = params.get("state");
    const expiresIn = params.get("expires_in");

    if (!window.opener) {
      window.close();
      return;
    }

    if (error) {
      window.opener.postMessage(
        { type: "oauth_callback", error: errorDescription || error },
        window.location.origin
      );
      window.close();
      return;
    }

    if (!accessToken) {
      window.opener.postMessage(
        { type: "oauth_callback", error: "no_token" },
        window.location.origin
      );
      window.close();
      return;
    }

    // Fetch Google user info with the access token
    fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((info) => {
        window.opener.postMessage(
          {
            type: "oauth_callback",
            accessToken,
            email: info.email,
            name: info.name,
            picture: info.picture,
            state,
            expiresIn,
          },
          window.location.origin
        );
      })
      .catch(() => {
        window.opener.postMessage(
          { type: "oauth_callback", accessToken, state },
          window.location.origin
        );
      })
      .finally(() => window.close());
  }, []);

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", fontFamily: "system-ui, sans-serif", background: "#FAFAFA",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "36px", marginBottom: "16px" }}>🔐</div>
        <p style={{ color: "#666", fontSize: "14px", margin: 0 }}>
          Connexion en cours, veuillez patienter…
        </p>
      </div>
    </div>
  );
}
