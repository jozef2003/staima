"""
James OAuth Flow — einmalig lokal ausführen.
Erstellt james_authorized_user.json + james_gogcli_token.json für james@myty.agency.

Usage: python3 get_james_token.py
Danach: Jozef meldet sich; Claude uploaded Token auf Server.
"""

import json
import os
import sys
from datetime import datetime, timezone
from google_auth_oauthlib.flow import InstalledAppFlow

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

BOT_DIR = os.path.dirname(__file__)
CLIENT_SECRET_FILE = os.path.join(BOT_DIR, "client_secret_james_new.json")
AUTHORIZED_USER_FILE = os.path.join(BOT_DIR, "james_authorized_user.json")
GOGCLI_TOKEN_FILE = os.path.join(BOT_DIR, "james_gogcli_token.json")
BOT_EMAIL = "james@myty.agency"


def main():
    print("=== James OAuth Flow ===")
    print(f"Browser öffnet sich — mit {BOT_EMAIL} einloggen.\n")

    with open(CLIENT_SECRET_FILE) as f:
        client_config = json.load(f)

    flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
    creds = flow.run_local_server(
        port=0,
        prompt="consent",
        access_type="offline",
        open_browser=False,
        authorization_prompt_message="\n>>> KLICKE AUF DIESEN LINK:\n{url}\n",
    )

    if not creds.refresh_token:
        print("FEHLER: Kein refresh_token erhalten.")
        sys.exit(1)

    expiry = creds.expiry.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z") if creds.expiry else None

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
    print(f"✓ {AUTHORIZED_USER_FILE}")

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
    print(f"✓ {GOGCLI_TOKEN_FILE}")

    print(f"\nFertig. Sag Claude Bescheid.")


if __name__ == "__main__":
    main()
