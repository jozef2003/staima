-- CRK Lead Agent — Migration 0003: Volltext-Tracking + Lead-Enrichment
-- Additiv & idempotent. In Supabase SQL Editor paste-and-run (nach 0002).

-- 1) Volltext-Fetcher: merken ob wir den Artikel-Body schon geholt haben,
--    damit fetch_fulltext nicht jede Woche dieselben URLs erneut zieht.
ALTER TABLE crk_articles
  ADD COLUMN IF NOT EXISTS fulltext_fetched BOOLEAN DEFAULT false;

-- Vorfilter-Status: schneller Keyword-Gate vor dem teuren LLM. NULL = noch
-- nicht geprüft, false = vom Prefilter verworfen (kein LLM-Call nötig).
-- Reuse: is_relevant (NULL) bleibt das Signal für "LLM muss noch ran".

-- 2) Lead-Enrichment: aus Roh-Lead wird kontaktierbarer Lead.
ALTER TABLE crk_leads
  ADD COLUMN IF NOT EXISTS confidence       TEXT,          -- Datenqualität laut Scorer: hoch | mittel | tief
  ADD COLUMN IF NOT EXISTS recherche_hinweis TEXT,         -- "Angaben unvollständig — Nachrecherche empfohlen"
  ADD COLUMN IF NOT EXISTS bauherr          TEXT,          -- best-guess Bauherr/Investor/Entwickler
  ADD COLUMN IF NOT EXISTS bauherr_website  TEXT,          -- Firmen-Website (geraten/extrahiert)
  ADD COLUMN IF NOT EXISTS kontakt_hinweis  TEXT,          -- Wie kommt CRK BD an die richtige Person?
  ADD COLUMN IF NOT EXISTS aufhaenger       TEXT,          -- 1-Satz Erstkontakt-Aufhänger für BD
  ADD COLUMN IF NOT EXISTS enriched         BOOLEAN DEFAULT false;

-- Index für den Enrichment-Step (Leads die noch angereichert werden müssen)
CREATE INDEX IF NOT EXISTS idx_crk_leads_enriched ON crk_leads(enriched) WHERE enriched = false;
