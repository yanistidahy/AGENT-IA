import os
import httpx
import smtplib
import ssl
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="Aura Flow AI Backend", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class SmtpTestRequest(BaseModel):
    host: str
    port: int = 587
    email: str
    password: str


@app.get("/")
def root():
    return {"status": "ok"}


@app.get("/health")
def health():
    return {"status": "ok", "service": "Aura Flow AI Backend"}


@app.post("/api/pipedream/connect-token")
async def connect_token(data: dict):
    client_id = os.environ.get("PIPEDREAM_CLIENT_ID")
    client_secret = os.environ.get("PIPEDREAM_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="PIPEDREAM_CLIENT_ID/SECRET non configurés")

    async with httpx.AsyncClient() as client:
        token_r = await client.post(
            "https://api.pipedream.com/v1/oauth/token",
            json={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
            },
        )
        token_r.raise_for_status()
        access_token = token_r.json().get("access_token")

        connect_r = await client.post(
            "https://api.pipedream.com/v1/connect/proj_jBsEq4e/tokens",
            headers={"Authorization": f"Bearer {access_token}"},
            json={"external_user_id": data.get("user_id", "housni")},
        )
        connect_r.raise_for_status()
        return connect_r.json()


@app.post("/api/test-smtp")
async def test_smtp(data: SmtpTestRequest):
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(data.host, data.port, timeout=10) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(data.email, data.password)
        return {"success": True, "email": data.email}
    except smtplib.SMTPAuthenticationError:
        return {"success": False, "error": "Identifiants incorrects — vérifiez l'email et le mot de passe."}
    except smtplib.SMTPConnectError:
        return {"success": False, "error": f"Impossible de se connecter à {data.host}:{data.port}"}
    except TimeoutError:
        return {"success": False, "error": "Connexion expirée — vérifiez le serveur et le port."}
    except Exception as e:
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
