"""Google Sheets integration for writing and managing leads."""

import logging
import os
from datetime import date
from pathlib import Path

import gspread

from config import GOOGLE_SHEET_ID, GOOGLE_SHEETS_CREDENTIALS_FILE

logger = logging.getLogger(__name__)

BOT_DIR = Path(__file__).parent

HEADERS = [
    "Datum",
    "Firma",
    "Nische",
    "Stadt",
    "Ansprechpartner",
    "Position",
    "Email",
    "Telefon",
    "Website",
    "Status",
    "Notizen",
]


SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]


def get_sheet() -> gspread.Worksheet:
    """Authenticate via Service Account and return the first worksheet."""
    from google.oauth2.service_account import Credentials

    creds_path = BOT_DIR / "credentials.json"
    credentials = Credentials.from_service_account_file(str(creds_path), scopes=SCOPES)
    client = gspread.authorize(credentials)
    spreadsheet = client.open_by_key(GOOGLE_SHEET_ID)
    worksheet = spreadsheet.sheet1

    # Ensure headers exist
    existing = worksheet.row_values(1)
    if not existing:
        worksheet.update("A1", [HEADERS])
        worksheet.format("A1:K1", {"textFormat": {"bold": True}})
        logger.info("Created headers in sheet")

    return worksheet


def get_existing_leads(worksheet: gspread.Worksheet) -> set[str]:
    """Get set of existing lead keys (firma+stadt) for dedup."""
    records = worksheet.get_all_values()
    keys = set()
    for row in records[1:]:  # Skip header
        if len(row) >= 4:
            firma = row[1].strip().lower()
            stadt = row[3].strip().lower()
            keys.add(f"{firma}|{stadt}")
    return keys


def is_duplicate(lead: dict, existing_keys: set[str]) -> bool:
    """Check if a lead already exists in the sheet."""
    key = f"{lead['firma'].strip().lower()}|{lead['stadt'].strip().lower()}"
    return key in existing_keys


def write_leads(leads: list[dict], dry_run: bool = False) -> int:
    """Write leads to Google Sheet.

    Args:
        leads: List of lead dicts to write.
        dry_run: If True, log what would be written without touching the sheet.

    Returns:
        Number of leads written.
    """
    if dry_run:
        logger.info(f"[DRY RUN] Would write {len(leads)} leads:")
        for lead in leads:
            logger.info(
                f"  - {lead['firma']} ({lead['nische']}, {lead['stadt']}) "
                f"| {lead.get('ansprechpartner', '')} | {lead.get('email', '')}"
            )
        return len(leads)

    worksheet = get_sheet()
    existing_keys = get_existing_leads(worksheet)

    rows_to_write = []
    today = date.today().isoformat()

    for lead in leads:
        if is_duplicate(lead, existing_keys):
            logger.info(f"Skipping duplicate: {lead['firma']} in {lead['stadt']}")
            continue

        row = [
            today,
            lead.get("firma", ""),
            lead.get("nische", ""),
            lead.get("stadt", ""),
            lead.get("ansprechpartner", ""),
            lead.get("position", ""),
            lead.get("email", ""),
            lead.get("telefon", ""),
            lead.get("website", ""),
            "Neu",
            "",
        ]
        rows_to_write.append(row)

        # Add to existing keys to prevent dupes within same batch
        key = f"{lead['firma'].strip().lower()}|{lead['stadt'].strip().lower()}"
        existing_keys.add(key)

    if rows_to_write:
        worksheet.append_rows(rows_to_write, value_input_option="USER_ENTERED")
        logger.info(f"Wrote {len(rows_to_write)} new leads to sheet")
    else:
        logger.info("No new leads to write (all duplicates)")

    return len(rows_to_write)
