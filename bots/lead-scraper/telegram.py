"""Telegram integration - Marlene sends Fabio's daily report."""

import logging
import os

import requests

logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
TELEGRAM_API = "https://api.telegram.org/bot{token}"


def send_report(summary: dict, sheet_url: str = "") -> bool:
    """Send Fabio's daily lead report via Marlene on Telegram.

    Args:
        summary: The summary dict from main.run().
        sheet_url: Optional link to the Google Sheet.

    Returns:
        True if message was sent successfully.
    """
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        logger.warning("Telegram not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID missing)")
        return False

    message = _format_report(summary, sheet_url)

    try:
        url = f"{TELEGRAM_API.format(token=TELEGRAM_BOT_TOKEN)}/sendMessage"
        resp = requests.post(url, json={
            "chat_id": TELEGRAM_CHAT_ID,
            "text": message,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }, timeout=10)
        resp.raise_for_status()
        logger.info("Telegram report sent successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to send Telegram report: {e}")
        return False


def _format_report(summary: dict, sheet_url: str) -> str:
    """Format the summary into a nice Telegram message."""
    total = summary.get("gefunden", 0)
    written = summary.get("geschrieben", 0)
    city = summary.get("stadt", "?")
    datum = summary.get("datum", "?")

    lines = [
        f"<b>Marlene - Täglicher Report</b>",
        f"",
        f"Fabio hat heute <b>{written} neue Leads</b> gefunden.",
        f"",
        f"Stadt: {city}",
        f"Datum: {datum}",
        f"",
    ]

    # Niche breakdown
    nischen = summary.get("nischen", {})
    if nischen:
        lines.append("<b>Aufschlüsselung:</b>")
        for name, stats in nischen.items():
            count = stats.get("gefunden", 0)
            emails = stats.get("mit_email", 0)
            contacts = stats.get("mit_ansprechpartner", 0)
            if count > 0:
                lines.append(f"  {name}: {count} Leads, {emails} mit Email, {contacts} mit Kontakt")
        lines.append("")

    # Quality stats
    total_with_email = sum(s.get("mit_email", 0) for s in nischen.values())
    total_with_contact = sum(s.get("mit_ansprechpartner", 0) for s in nischen.values())
    if total > 0:
        email_pct = round(total_with_email / total * 100)
        contact_pct = round(total_with_contact / total * 100)
        lines.append(f"Qualität: {email_pct}% mit Email, {contact_pct}% mit Ansprechpartner")
        lines.append("")

    if sheet_url:
        lines.append(f'<a href="{sheet_url}">Google Sheet öffnen</a>')

    return "\n".join(lines)
