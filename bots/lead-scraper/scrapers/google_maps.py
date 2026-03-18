"""Google Places API scraper for finding business leads."""

import logging
from typing import Optional

import googlemaps

from config import (
    GOOGLE_MAPS_API_KEY,
    FETCH_MULTIPLIER,
    MIN_RATING,
    MIN_REVIEWS,
    get_keyword_for_niche,
)

logger = logging.getLogger(__name__)


def create_client() -> googlemaps.Client:
    """Create Google Maps API client."""
    if not GOOGLE_MAPS_API_KEY:
        raise ValueError("GOOGLE_MAPS_API_KEY not set in .env")
    return googlemaps.Client(key=GOOGLE_MAPS_API_KEY)


def search_businesses(
    niche: dict, city: str, max_results: int = 5
) -> list[dict]:
    """Search for businesses, fetch extra, then return the best ones.

    Fetches FETCH_MULTIPLIER * max_results candidates, scores them,
    and returns the top max_results by quality.
    """
    client = create_client()
    candidates = []

    keyword = get_keyword_for_niche(niche)
    query = f"{keyword} in {city}, Deutschland"
    fetch_count = max_results * FETCH_MULTIPLIER

    logger.info(f"Searching: {query} (fetching up to {fetch_count})")

    try:
        results = client.places(
            query=query,
            language="de",
            type=niche.get("places_type"),
        )
    except Exception as e:
        logger.error(f"Places API error for '{query}': {e}")
        return []

    for place in results.get("results", [])[:fetch_count]:
        lead = _extract_lead(client, place, niche["name"], city)
        if lead:
            candidates.append(lead)

    # Score and sort by quality
    scored = [(lead, _score_lead(lead)) for lead in candidates]
    scored.sort(key=lambda x: x[1], reverse=True)

    best = [lead for lead, score in scored[:max_results] if score > 0]
    logger.info(
        f"Found {len(candidates)} candidates, selected {len(best)} quality leads "
        f"for {niche['name']} in {city}"
    )
    return best


def _extract_lead(
    client: googlemaps.Client, place: dict, niche_name: str, city: str
) -> Optional[dict]:
    """Extract lead info from a Places API result."""
    place_id = place.get("place_id")
    if not place_id:
        return None

    try:
        details = client.place(
            place_id,
            fields=[
                "name",
                "formatted_address",
                "formatted_phone_number",
                "website",
                "rating",
                "user_ratings_total",
            ],
            language="de",
        ).get("result", {})
    except Exception as e:
        logger.warning(f"Could not get details for {place.get('name')}: {e}")
        details = place

    return {
        "firma": details.get("name", ""),
        "nische": niche_name,
        "stadt": city,
        "adresse": details.get("formatted_address", ""),
        "telefon": details.get("formatted_phone_number", ""),
        "website": details.get("website", ""),
        "bewertung": details.get("rating", ""),
        "anzahl_bewertungen": details.get("user_ratings_total", ""),
        "ansprechpartner": "",
        "position": "",
        "email": "",
    }


def _score_lead(lead: dict) -> float:
    """Score a lead from 0-100 for quality. Higher = better prospect.

    Scoring:
    - Has website: +30 (essential for contact + shows they're established)
    - Has phone: +10
    - Rating 3.5-4.8: +20 (sweet spot: good but not so big they don't need help)
    - Rating <3.0: -50 (probably bad business, avoid)
    - Has enough reviews (social proof they're real): +15
    - Not a huge chain (< 500 reviews): +15
    - Has address: +10
    """
    score = 0.0

    # Website is critical - can't scrape contact info without it
    if lead.get("website"):
        score += 30
    else:
        score -= 10

    if lead.get("telefon"):
        score += 10

    if lead.get("adresse"):
        score += 10

    rating = lead.get("bewertung")
    if rating and isinstance(rating, (int, float)):
        if rating < MIN_RATING:
            score -= 50  # Too low = bad business
        elif 3.5 <= rating <= 4.8:
            score += 20  # Sweet spot
        elif rating > 4.8:
            score += 10  # Very high = might already be optimized

    num_reviews = lead.get("anzahl_bewertungen")
    if num_reviews and isinstance(num_reviews, (int, float)):
        if num_reviews < MIN_REVIEWS:
            score -= 5   # Might be too new/small
        elif num_reviews < 500:
            score += 15  # Good size - not a chain
        else:
            score += 5   # Big chain, less likely to need us

    return score
