from instagrapi import Client
from instagrapi.exceptions import LoginRequired, ChallengeRequired, BadPassword, UserNotFound
import time
import random
import os
from typing import List, Optional

SESSION_FILE = os.environ.get("INSTAGRAM_SESSION_FILE", "session.json")

FOUNDER_KEYWORDS = [
    "fondateur", "fondatrice", "founder", "co-founder", "cofondateur",
    "ceo", "créateur", "créatrice", "directeur", "directrice",
    "entrepreneur", "boss", "owner", "gérante", "gérant",
    "pdg", "président", "présidente",
]

ECOM_KEYWORDS = [
    "boutique", "shop", "store", "ecommerce", "e-commerce", "shopify",
    "woocommerce", "prestashop", "marque", "brand", "collection",
    "mode", "beauté", "beauty", "lifestyle", "food", "maison",
    "bijoux", "accessoires", "vêtements", "cosmétique",
]


def is_founder(bio: str) -> bool:
    bio_lower = bio.lower()
    return any(kw in bio_lower for kw in FOUNDER_KEYWORDS)


def has_ecom_signals(bio: str, external_url: str) -> bool:
    bio_lower = bio.lower()
    return any(kw in bio_lower for kw in ECOM_KEYWORDS) or bool(external_url)


def score_prospect(user_info) -> int:
    score = 0
    bio = user_info.biography or ""
    ext_url = str(user_info.external_url or "")

    if is_founder(bio):
        score += 3
    if has_ecom_signals(bio, ext_url):
        score += 2
    if user_info.external_url:
        score += 2
    if 1000 <= user_info.follower_count <= 50000:
        score += 2
    elif 50001 <= user_info.follower_count <= 100000:
        score += 1
    if user_info.media_count and user_info.media_count > 10:
        score += 1

    return min(score, 10)


def get_score_label(score: int) -> str:
    if score >= 7:
        return "Chaud"
    if score >= 4:
        return "Tiède"
    return "Froid"


def get_actions(score: int) -> List[str]:
    if score >= 8:
        return ["Follow", "Like ×3", "Story", "Commentaire"]
    if score >= 6:
        return ["Follow", "Like ×3", "Story"]
    if score >= 4:
        return ["Follow", "Like ×2"]
    return ["Like ×1"]


def _build_client(username: str, password: str) -> Client:
    cl = Client()
    cl.delay_range = [2, 5]

    if os.path.exists(SESSION_FILE):
        try:
            cl.load_settings(SESSION_FILE)
            cl.login(username, password)
            cl.dump_settings(SESSION_FILE)
            return cl
        except Exception:
            pass

    cl.login(username, password)
    cl.dump_settings(SESSION_FILE)
    return cl


async def validate_instagram_account(username: str, password: str) -> dict:
    try:
        cl = _build_client(username, password)
        info = cl.account_info()
        cl.logout()
        return {
            "success": True,
            "username": info.username,
            "full_name": info.full_name,
            "follower_count": info.follower_count,
        }
    except BadPassword:
        return {"success": False, "error": "Mot de passe incorrect"}
    except ChallengeRequired:
        return {"success": False, "error": "Instagram demande une vérification (2FA). Connectez-vous d'abord depuis l'app mobile."}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def scrape_followers(
    username: str,
    password: str,
    target_accounts: List[str],
    max_per_account: int = 100,
    filters=None,
) -> List[dict]:
    try:
        cl = _build_client(username, password)
    except BadPassword:
        raise Exception("Mot de passe Instagram incorrect")
    except ChallengeRequired:
        raise Exception("Instagram demande une vérification. Reconnectez-vous depuis l'app mobile puis réessayez.")
    except Exception as e:
        raise Exception(f"Connexion Instagram échouée : {str(e)}")

    all_prospects = []
    seen_ids = set()

    for account_handle in target_accounts:
        handle = account_handle.lstrip("@").strip()
        try:
            time.sleep(random.uniform(2, 4))
            user_id = cl.user_id_from_username(handle)
            followers = cl.user_followers(user_id, amount=max_per_account)

            for fid, user in followers.items():
                if fid in seen_ids:
                    continue
                seen_ids.add(fid)

                try:
                    time.sleep(random.uniform(0.8, 2.0))
                    info = cl.user_info(fid)

                    if info.is_private:
                        continue

                    bio = info.biography or ""
                    ext_url = str(info.external_url or "")

                    if filters:
                        if filters.require_founder_bio and not is_founder(bio):
                            continue
                        if filters.require_link and not info.external_url:
                            continue
                        if info.follower_count < filters.min_followers:
                            continue
                        if info.follower_count > filters.max_followers:
                            continue

                    score = score_prospect(info)
                    if score < 3:
                        continue

                    all_prospects.append({
                        "handle": f"@{info.username}",
                        "nom": info.full_name or info.username,
                        "bio": (bio[:120] + "...") if len(bio) > 120 else bio,
                        "abonnes": info.follower_count,
                        "lien_boutique": ext_url if info.external_url else None,
                        "score": score,
                        "score_label": get_score_label(score),
                        "actions": get_actions(score),
                        "source_compte": f"@{handle}",
                        "is_private": info.is_private,
                    })

                except Exception:
                    continue

        except UserNotFound:
            print(f"Compte introuvable : @{handle}")
            continue
        except Exception as e:
            print(f"Erreur @{handle} : {e}")
            continue

    try:
        cl.logout()
    except Exception:
        pass

    all_prospects.sort(key=lambda x: x["score"], reverse=True)
    return all_prospects[:100]
