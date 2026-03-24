"""
Sietch OAuth Flow — einmalig lokal ausführen.
Erstellt authorized_user.json (für Python/gspread) UND gogcli_token.json (für OpenClaw gog).

Usage: python3 get_oauth_token.py
Danach: scp authorized_user.json + gogcli_token.json auf den Server laden
        gog auth tokens import gogcli_token.json
"""

import json
import os
import sys
from datetime import datetime, timezone
from google_auth_oauthlib.flow import InstalledAppFlow

# ─── Alle Scopes die ein AI-Assistent braucht ───────────────
SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.settings.basic",
    "https://www.googleapis.com/auth/gmail.settings.sharing",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/contacts",
    "https://www.googleapis.com/auth/contacts.other.readonly",
]

# Lege client_secret.json (aus GCP Console) neben dieses Script,
# oder trage client_id + client_secret als Env-Variablen ein.
_CLIENT_SECRET_FILE = os.path.join(os.path.dirname(__file__), "client_secret.json")
if os.path.exists(_CLIENT_SECRET_FILE):
    with open(_CLIENT_SECRET_FILE) as f:
        CLIENT_CONFIG = json.load(f)
else:
    CLIENT_CONFIG = {
        "installed": {
            "client_id": os.environ.get("GOOGLE_CLIENT_ID", "YOUR_CLIENT_ID"),
            "project_id": "capable-memory-489912-n6",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET", "YOUR_CLIENT_SECRET"),
            "redirect_uris": ["http://localhost"],
        }
    }

BOT_DIR = os.path.dirname(__file__)
AUTHORIZED_USER_FILE = os.path.join(BOT_DIR, "authorized_user.json")
GOGCLI_TOKEN_FILE = os.path.join(BOT_DIR, "gogcli_token.json")
BOT_EMAIL = "sietch@myty.agency"


def main():
    print("=== Sietch Google OAuth Flow ===")
    print("Browser öffnet sich — mit Fabians Google Account einloggen.\n")

    flow = InstalledAppFlow.from_client_config(CLIENT_CONFIG, SCOPES)
    creds = flow.run_local_server(port=0, prompt="consent", access_type="offline")

    if not creds.refresh_token:
        print("FEHLER: Kein refresh_token erhalten. Bitte nochmal mit 'prompt=consent' versuchen.")
        sys.exit(1)

    expiry = creds.expiry.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z") if creds.expiry else None

    # ── 1. authorized_user.json (für Python/gspread) ─────────
    authorized_user = {
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": sorted(creds.scopes),
        "universe_domain": "googleapis.com",
        "account": BOT_EMAIL,
        "expiry": expiry,
    }
    with open(AUTHORIZED_USER_FILE, "w") as f:
        json.dump(authorized_user, f, indent=2)
    print(f"✓ authorized_user.json → {AUTHORIZED_USER_FILE}")

    # ── 2. gogcli_token.json (für gog auth tokens import) ────
    gogcli_token = {
        "email": BOT_EMAIL,
        "client": "default",
        "services": ["calendar", "contacts", "docs", "drive", "gmail", "sheets"],
        "scopes": sorted(creds.scopes),
        "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "refresh_token": creds.refresh_token,
    }
    with open(GOGCLI_TOKEN_FILE, "w") as f:
        json.dump(gogcli_token, f, indent=2)
    print(f"✓ gogcli_token.json    → {GOGCLI_TOKEN_FILE}")

    print(f"\n  refresh_token: {creds.refresh_token[:25]}...")
    print("\n─── Nächste Schritte ──────────────────────────────────────")
    print("1. Dateien hochladen:")
    print(f"   scp bots/sietch/authorized_user.json root@SERVER:/opt/sietch/.openclaw/")
    print(f"   scp bots/sietch/gogcli_token.json root@SERVER:/tmp/sietch_token.json")
    print("\n2. Token in gogcli importieren (kein Browser auf Server nötig):")
    print(f"   ssh root@SERVER 'GOG_KEYRING_PASSWORD=openclaw-sietch-keyring-2026 HOME=/opt/sietch gog auth tokens import /tmp/sietch_token.json'")
    print(f"   ssh root@SERVER 'rm /tmp/sietch_token.json'")


if __name__ == "__main__":
    main()
