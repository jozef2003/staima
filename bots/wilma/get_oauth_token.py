#!/usr/bin/env python3
"""
Run this ONCE locally to get a Google OAuth token for wilma@myty.agency.
Then upload the token to the server.

Usage:
  python3 bots/wilma/get_oauth_token.py
"""

import os, json, webbrowser
from google_auth_oauthlib.flow import Flow

CLIENT_SECRET_FILE = os.path.expanduser(
    '~/Downloads/client_secret_311703949501-i8fl8nl13eie5nu40bcutu161uriskbf.apps.googleusercontent.com.json'
)

BOT_EMAIL = "wilma@myty.agency"

SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/drive",
]

flow = Flow.from_client_secrets_file(
    CLIENT_SECRET_FILE, SCOPES,
    redirect_uri='urn:ietf:wg:oauth:2.0:oob'
)

auth_url, _ = flow.authorization_url(login_hint=BOT_EMAIL, prompt='consent')
print(f"\nÖffne diesen Link im Browser:\n\n{auth_url}\n")
print(f"Login mit: {BOT_EMAIL}")
webbrowser.open(auth_url)

code = input("\nCode aus dem Browser hier einfügen: ").strip()
flow.fetch_token(code=code)
creds = flow.credentials

token_data = json.loads(creds.to_json())
token_file = "/tmp/wilma_token.json"
with open(token_file, "w") as f:
    json.dump(token_data, f, indent=2)

print(f"\nToken saved to {token_file}")
print("\nNow run:")
print(f"  scp -i ~/.ssh/id_ed25519 {token_file} root@94.130.99.75:/tmp/wilma_token.json")
print("  ssh -i ~/.ssh/id_ed25519 root@94.130.99.75")
print("  cd /opt/wilma && GOG_KEYRING_PASSWORD=openclaw-wilma-keyring-2026 gogcli token import /tmp/wilma_token.json --account google:wilma@myty.agency")
