"""Web scraper for extracting contact details from business websites."""

import logging
import re
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# Timeout for HTTP requests in seconds
REQUEST_TIMEOUT = 10

# Pages to check for contact info
CONTACT_PATHS = [
    "/impressum",
    "/kontakt",
    "/about",
    "/ueber-uns",
    "/team",
    "/about-us",
    "/contact",
]

# Regex patterns
EMAIL_PATTERN = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
)

# German business titles that indicate decision makers
TITLE_PATTERNS = [
    r"Geschäftsführer(?:in)?",
    r"Inhaber(?:in)?",
    r"Partner(?:in)?",
    r"Rechtsanw[aä]lt(?:in)?",
    r"Notar(?:in)?",
    r"Steuerberater(?:in)?",
    r"(?:Fach)?[Aa]rzt|(?:Fach)?[Ää]rztin",
    r"Makler(?:in)?",
    r"Meister(?:in)?",
    r"Vorstand",
    r"Gründer(?:in)?",
    r"CEO|CTO|CFO|COO",
    r"Leitung|Leiter(?:in)?",
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
}


def enrich_lead(lead: dict) -> dict:
    """Enrich a lead with contact details scraped from the website.

    Args:
        lead: Lead dict with at least a 'website' field.

    Returns:
        Updated lead dict with ansprechpartner, position, and email filled in.
    """
    website = lead.get("website", "")
    if not website:
        return lead

    # Normalize URL
    if not website.startswith("http"):
        website = "https://" + website

    # Try to find contact info from main page + contact pages
    pages_to_scrape = [website]
    for path in CONTACT_PATHS:
        pages_to_scrape.append(urljoin(website, path))

    all_emails = set()
    best_contact = None

    for url in pages_to_scrape:
        html = _fetch_page(url)
        if not html:
            continue

        soup = BeautifulSoup(html, "html.parser")

        # Extract emails
        page_emails = _extract_emails(soup, url)
        all_emails.update(page_emails)

        # Extract contact person
        contact = _extract_contact_person(soup)
        if contact and not best_contact:
            best_contact = contact

    # Update lead
    if best_contact:
        lead["ansprechpartner"] = best_contact.get("name", "")
        lead["position"] = best_contact.get("position", "")

    if all_emails:
        # Prefer personal emails over generic ones
        lead["email"] = _pick_best_email(all_emails)

    return lead


def _fetch_page(url: str) -> Optional[str]:
    """Fetch a web page and return its HTML content."""
    try:
        response = requests.get(
            url, headers=HEADERS, timeout=REQUEST_TIMEOUT, allow_redirects=True
        )
        response.raise_for_status()

        content_type = response.headers.get("Content-Type", "")
        if "text/html" not in content_type:
            return None

        return response.text
    except requests.RequestException:
        return None


def _extract_emails(soup: BeautifulSoup, page_url: str) -> set[str]:
    """Extract email addresses from a page."""
    emails = set()
    text = soup.get_text(separator=" ")

    for match in EMAIL_PATTERN.finditer(text):
        email = match.group().lower().strip(".")
        # Filter out image files and common false positives
        if not any(
            email.endswith(ext)
            for ext in [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"]
        ):
            emails.add(email)

    # Also check mailto: links
    for link in soup.find_all("a", href=True):
        href = link["href"]
        if href.startswith("mailto:"):
            email = href.replace("mailto:", "").split("?")[0].strip().lower()
            if EMAIL_PATTERN.match(email):
                emails.add(email)

    return emails


def _extract_contact_person(soup: BeautifulSoup) -> Optional[dict]:
    """Try to extract a contact person's name and position from the page."""
    text = soup.get_text(separator="\n")

    for pattern in TITLE_PATTERNS:
        regex = re.compile(
            rf"({pattern})\s*[:\-]?\s*([A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][a-zäöüß]+)",
            re.UNICODE,
        )
        match = regex.search(text)
        if match:
            return {
                "position": match.group(1).strip(),
                "name": match.group(2).strip(),
            }

    # Try reverse: Name followed by title
    for pattern in TITLE_PATTERNS:
        regex = re.compile(
            rf"([A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][a-zäöüß]+)\s*[,\-|]\s*({pattern})",
            re.UNICODE,
        )
        match = regex.search(text)
        if match:
            return {
                "name": match.group(1).strip(),
                "position": match.group(2).strip(),
            }

    return None


def _pick_best_email(emails: set[str]) -> str:
    """Pick the best email from a set, preferring personal over generic."""
    generic_prefixes = [
        "info@", "kontakt@", "contact@", "office@", "mail@",
        "post@", "service@", "hello@", "hallo@", "empfang@",
        "noreply@", "no-reply@",
    ]

    personal = []
    generic = []

    for email in emails:
        if any(email.startswith(prefix) for prefix in generic_prefixes):
            generic.append(email)
        else:
            personal.append(email)

    if personal:
        return sorted(personal)[0]
    if generic:
        # Prefer info@ and kontakt@ over others
        for prefix in ["info@", "kontakt@"]:
            for email in generic:
                if email.startswith(prefix):
                    return email
        return sorted(generic)[0]

    return ""
