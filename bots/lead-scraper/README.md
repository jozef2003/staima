# Fabio - Lead Scraper Bot

Findet täglich 20 deutsche Firmen-Leads und schreibt sie in ein Google Sheet.

## Zielgruppen

- Anwaltskanzleien
- Arztpraxen
- Immobilienbüros
- Steuerberater
- Handwerksbetriebe
- Mittelstand (GmbHs)

## Setup

### 1. Python-Dependencies installieren

```bash
pip install -r requirements.txt
```

### 2. Google Maps API Key

1. [Google Cloud Console](https://console.cloud.google.com/) -> APIs & Services -> Credentials
2. API Key erstellen
3. Places API aktivieren
4. Key in `.env` eintragen

### 3. Google Sheets Service Account

1. Google Cloud Console -> IAM & Admin -> Service Accounts
2. Service Account erstellen
3. JSON Key herunterladen -> als `credentials.json` speichern
4. Google Sheets API und Google Drive API aktivieren
5. Sheet erstellen und Service Account E-Mail als Editor einladen
6. Sheet ID in `.env` eintragen

### 4. .env einrichten

```bash
cp .env.example .env
# Werte eintragen
```

## Nutzung

```bash
# Dry Run - zeigt was geschrieben würde
python main.py --dry-run

# Test mit 5 Leads
python main.py --count 5

# Voller Lauf (20 Leads)
python main.py
```

## Cron einrichten

```bash
# Täglich um 8:00 Uhr
0 8 * * * cd /path/to/Staima/bots/lead-scraper && python main.py >> /var/log/lead-scraper.log 2>&1
```

## Sheet-Spalten

| Datum | Firma | Nische | Stadt | Ansprechpartner | Position | Email | Telefon | Website | Status | Notizen |
