"""Nischen-Definitionen, Stadt-Rotation und Settings."""

import json
import os
from datetime import date
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BOT_DIR = Path(__file__).parent

# --- API Keys & Credentials ---
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")
GOOGLE_SHEETS_CREDENTIALS_FILE = os.getenv("GOOGLE_SHEETS_CREDENTIALS_FILE", "./credentials.json")
GOOGLE_SHEET_ID = os.getenv("GOOGLE_SHEET_ID", "")

# --- Lead Settings ---
LEADS_PER_DAY = 20
# Fetch more than needed so we can filter for quality
FETCH_MULTIPLIER = 3

# --- Quality Filters ---
MIN_RATING = 3.0          # Mindestbewertung (zu schlecht = unseriös)
MAX_RATING = 5.0          # Maximal (alle ok)
MIN_REVIEWS = 3           # Mindestanzahl Bewertungen (sonst zu klein/neu)
PREFER_WITH_WEBSITE = True  # Firmen ohne Website = schwer zu kontaktieren

# --- Nischen ---
NICHES = [
    {
        "name": "Anwaltskanzleien",
        "keywords": ["Rechtsanwalt", "Kanzlei", "Anwalt"],
        "places_type": "lawyer",
    },
    {
        "name": "Arztpraxen",
        "keywords": ["Arztpraxis", "Facharzt"],
        "places_type": "doctor",
    },
    {
        "name": "Immobilienbüros",
        "keywords": ["Immobilienmakler", "Immobilienbüro"],
        "places_type": "real_estate_agency",
    },
    {
        "name": "Steuerberater",
        "keywords": ["Steuerberater", "Steuerkanzlei"],
        "places_type": "accounting",
    },
    {
        "name": "Handwerksbetriebe",
        "keywords": ["Handwerker", "Meisterbetrieb"],
        "places_type": "general_contractor",
    },
    {
        "name": "Mittelstand",
        "keywords": ["GmbH", "Geschäftsführer"],
        "places_type": None,
    },
]

CITIES = [
    "Berlin",
    "München",
    "Hamburg",
    "Köln",
    "Frankfurt",
    "Stuttgart",
    "Düsseldorf",
    "Leipzig",
    "Dresden",
    "Nürnberg",
]

# --- Rotation State ---
ROTATION_FILE = BOT_DIR / "rotation_state.json"


def _load_rotation() -> dict:
    if ROTATION_FILE.exists():
        return json.loads(ROTATION_FILE.read_text())
    return {"city_index": 0, "keyword_index": {}}


def _save_rotation(state: dict):
    ROTATION_FILE.write_text(json.dumps(state, indent=2))


def get_todays_city() -> str:
    """Get next city in rotation and advance the pointer."""
    state = _load_rotation()
    idx = state.get("city_index", 0) % len(CITIES)
    city = CITIES[idx]
    state["city_index"] = idx + 1
    _save_rotation(state)
    return city


def get_keyword_for_niche(niche: dict) -> str:
    """Rotate through keywords for a niche so we get varied results."""
    state = _load_rotation()
    kw_indices = state.get("keyword_index", {})
    name = niche["name"]
    idx = kw_indices.get(name, 0) % len(niche["keywords"])
    keyword = niche["keywords"][idx]
    kw_indices[name] = idx + 1
    state["keyword_index"] = kw_indices
    _save_rotation(state)
    return keyword


def get_leads_per_niche(total: int = LEADS_PER_DAY) -> int:
    """Calculate how many leads to fetch per niche to reach daily target."""
    return max(1, total // len(NICHES))
