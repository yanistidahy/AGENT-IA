from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import smtplib
import ssl
import httpx

from instagram import scrape_followers, validate_instagram_account

PIPEDREAM_CLIENT_ID = os.environ.get("PIPEDREAM_CLIENT_ID")
PIPEDREAM_CLIENT_SECRET = os.environ.get("PIPEDREAM_CLIENT_SECRET")
PIPEDREAM_PROJECT_ID = "proj_jBsEq4e"


async def get_pd_access_token() -> str:
    async with httpx.AsyncClient() as client:
        r = await client.post(
            "https://api.pipedream.com/v1/oauth/token",
            json={
                "grant_type": "client_credentials",
                "client_id": PIPEDREAM_CLIENT_ID,
                "client_secret": PIPEDREAM_CLIENT_SECRET,
            },
        )
        r.raise_for_status()
        return r.json()["access_token"]

app = FastAPI(title="Nova Instagram Scraper", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ComptesCibles(BaseModel):
    comptes: List[str]
    instagram_username: str
    instagram_password: str
    max_par_compte: Optional[int] = 100


class ProspectFilter(BaseModel):
    min_followers: Optional[int] = 1000
    max_followers: Optional[int] = 100000
    require_link: Optional[bool] = False
    require_founder_bio: Optional[bool] = False


class ScrapeRequest(BaseModel):
    comptes: List[str]
    instagram_username: str
    instagram_password: str
    max_par_compte: Optional[int] = 100
    min_followers: Optional[int] = 1000
    max_followers: Optional[int] = 100000
    require_link: Optional[bool] = False
    require_founder_bio: Optional[bool] = False


class ValidateRequest(BaseModel):
    username: str
    password: str


class SmtpTestRequest(BaseModel):
    host: str
    port: int = 587
    email: str
    password: str


@app.post("/api/pipedream/connect-token")
async def create_connect_token(data: dict):
    if not PIPEDREAM_CLIENT_ID or not PIPEDREAM_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="PIPEDREAM_CLIENT_ID/SECRET non configurés sur le serveur")
    try:
        access_token = await get_pd_access_token()
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"https://api.pipedream.com/v1/connect/{PIPEDREAM_PROJECT_ID}/tokens",
                headers={"Authorization": f"Bearer {access_token}"},
                json={"external_user_id": data.get("user_id", "aura-flow-user")},
            )
            r.raise_for_status()
            return r.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Pipedream API error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health():
    return {"status": "ok", "service": "Nova Instagram Scraper"}


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


@app.post("/api/validate-account")
async def validate_account(data: ValidateRequest):
    try:
        result = await validate_instagram_account(data.username, data.password)
        return result
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/scrape")
async def scrape(data: ScrapeRequest):
    if not data.comptes:
        raise HTTPException(status_code=400, detail="Aucun compte cible fourni")
    if not data.instagram_username or not data.instagram_password:
        raise HTTPException(status_code=400, detail="Identifiants Instagram manquants")

    filters = ProspectFilter(
        min_followers=data.min_followers,
        max_followers=data.max_followers,
        require_link=data.require_link,
        require_founder_bio=data.require_founder_bio,
    )

    try:
        prospects = await scrape_followers(
            username=data.instagram_username,
            password=data.instagram_password,
            target_accounts=data.comptes,
            max_per_account=data.max_par_compte,
            filters=filters,
        )
        return {
            "success": True,
            "total": len(prospects),
            "prospects": prospects,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


