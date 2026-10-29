-- CRK Lead Agent — Migration 0004: Agentisches Enrichment (Web-Recherche)
-- Additiv & idempotent. In Supabase SQL Editor nach 0003 ausführen.
--
-- pipeline/enrich.py läuft jetzt als Agent mit WebSearch/WebFetch und recherchiert
-- echte Kontaktdaten + verifiziert den Lead. Diese Spalten halten das Ergebnis.

ALTER TABLE crk_leads
  ADD COLUMN IF NOT EXISTS ansprechpartner       TEXT,     -- konkrete Person (Name)
  ADD COLUMN IF NOT EXISTS ansprechpartner_rolle TEXT,     -- z.B. "Leiter Kommunikation"
  ADD COLUMN IF NOT EXISTS linkedin              TEXT,     -- LinkedIn-URL Person oder Firma
  ADD COLUMN IF NOT EXISTS kontakt_quelle        TEXT,     -- wo die Kontaktdaten gefunden wurden (URL)
  ADD COLUMN IF NOT EXISTS bereits_betreut       BOOLEAN,  -- hat erkennbar schon Agentur/Komm.-Abteilung?
  ADD COLUMN IF NOT EXISTS verify_note           TEXT;     -- Ergebnis der Web-Verifikation
