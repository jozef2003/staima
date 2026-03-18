"""Fabio - Lead Scraper Bot - Findet täglich 20 qualitative deutsche Firmen-Leads."""

import argparse
import logging
import sys
from datetime import date
from pathlib import Path

from config import NICHES, GOOGLE_SHEET_ID, get_leads_per_niche, get_todays_city
from scrapers.google_maps import search_businesses
from scrapers.web_scraper import enrich_lead
from sheets import write_leads
from telegram import send_report

SHEET_URL = f"https://docs.google.com/spreadsheets/d/{GOOGLE_SHEET_ID}/edit" if GOOGLE_SHEET_ID else ""

LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(
            LOG_DIR / f"{date.today().isoformat()}.log", encoding="utf-8"
        ),
    ],
)
logger = logging.getLogger(__name__)


def run(count: int = 20, dry_run: bool = False) -> dict:
    """Run the lead scraper.

    Args:
        count: Total number of leads to collect.
        dry_run: If True, don't write to Google Sheets.

    Returns:
        Summary dict with stats.
    """
    city = get_todays_city()
    leads_per_niche = get_leads_per_niche(count)

    logger.info("=== Fabio Start ===")
    logger.info(f"Datum: {date.today().isoformat()}")
    logger.info(f"Stadt: {city}")
    logger.info(f"Ziel: {count} Leads ({leads_per_niche} pro Nische)")

    all_leads = []

    for niche in NICHES:
        logger.info(f"\n--- Nische: {niche['name']} ---")

        # Step 1: Find businesses via Google Places (with quality scoring)
        leads = search_businesses(niche, city, max_results=leads_per_niche)

        # Step 2: Enrich each lead with website contact info
        for i, lead in enumerate(leads):
            logger.info(f"  Enriching {i + 1}/{len(leads)}: {lead['firma']}")
            leads[i] = enrich_lead(lead)

        all_leads.extend(leads)

    # Trim to target count
    all_leads = all_leads[:count]

    # Step 3: Write to Google Sheets (dedup happens inside)
    logger.info(f"\n--- Writing {len(all_leads)} leads ---")
    written = write_leads(all_leads, dry_run=dry_run)

    # Summary
    summary = {
        "datum": date.today().isoformat(),
        "stadt": city,
        "gefunden": len(all_leads),
        "geschrieben": written,
        "nischen": {},
    }

    for niche in NICHES:
        niche_leads = [l for l in all_leads if l["nische"] == niche["name"]]
        with_email = [l for l in niche_leads if l.get("email")]
        with_contact = [l for l in niche_leads if l.get("ansprechpartner")]
        summary["nischen"][niche["name"]] = {
            "gefunden": len(niche_leads),
            "mit_email": len(with_email),
            "mit_ansprechpartner": len(with_contact),
        }

    logger.info("\n=== Zusammenfassung ===")
    logger.info(f"Stadt: {city}")
    logger.info(f"Gefunden: {summary['gefunden']}")
    logger.info(f"Geschrieben: {summary['geschrieben']}")
    for niche_name, stats in summary["nischen"].items():
        logger.info(
            f"  {niche_name}: {stats['gefunden']} leads, "
            f"{stats['mit_email']} mit Email, "
            f"{stats['mit_ansprechpartner']} mit Ansprechpartner"
        )

    return summary


def main():
    parser = argparse.ArgumentParser(description="Fabio - Lead Scraper Bot")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be written without touching Google Sheets",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=20,
        help="Number of leads to collect (default: 20)",
    )
    args = parser.parse_args()

    try:
        summary = run(count=args.count, dry_run=args.dry_run)

        # Marlene sends report via Telegram
        if not args.dry_run:
            send_report(summary, sheet_url=SHEET_URL)

        logger.info("Fabio finished successfully.")
        return 0
    except Exception as e:
        logger.error(f"Fabio failed: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
