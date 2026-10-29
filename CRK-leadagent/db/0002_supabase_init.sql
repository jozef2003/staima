-- CRK Lead Agent — Schema für Supabase
-- Tabellen mit crk_ Prefix damit sie sich nicht mit Clipper-Tabellen kreuzen.
-- In Supabase SQL Editor paste-and-run.

CREATE TABLE IF NOT EXISTS crk_sources (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  kind       TEXT NOT NULL,
  url        TEXT NOT NULL,
  last_crawl TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crk_articles (
  id          BIGSERIAL PRIMARY KEY,
  source_id   INT REFERENCES crk_sources(id),
  url         TEXT NOT NULL UNIQUE,
  title       TEXT,
  published   TIMESTAMPTZ,
  fulltext    TEXT,
  fetched_at  TIMESTAMPTZ DEFAULT now(),

  is_relevant BOOLEAN,
  reasoning   TEXT,
  entities    JSONB
);

CREATE INDEX IF NOT EXISTS idx_crk_articles_published ON crk_articles(published DESC);
CREATE INDEX IF NOT EXISTS idx_crk_articles_relevant  ON crk_articles(is_relevant) WHERE is_relevant = true;

CREATE TABLE IF NOT EXISTS crk_leads (
  id                    BIGSERIAL PRIMARY KEY,
  week                  DATE NOT NULL,
  article_id            BIGINT REFERENCES crk_articles(id),

  projekt               TEXT NOT NULL,
  standort              TEXT,
  projekttyp            TEXT,
  phase                 TEXT,
  akteure               TEXT,
  kommunikationsbedarf  TEXT,
  potenzial             TEXT CHECK (potenzial IN ('Hoch','Mittel','Tief')),
  quelle                TEXT,
  quelle_url            TEXT,
  datum                 DATE,
  zusammenfassung       TEXT,

  fingerprint           TEXT,
  is_duplicate          BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crk_leads_week        ON crk_leads(week DESC);
CREATE INDEX IF NOT EXISTS idx_crk_leads_fingerprint ON crk_leads(fingerprint);

CREATE TABLE IF NOT EXISTS crk_lead_feedback (
  id         BIGSERIAL PRIMARY KEY,
  lead_id    BIGINT REFERENCES crk_leads(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('relevant','not_relevant','contacted','assigned')),
  note       TEXT,
  user_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crk_lead_feedback_lead ON crk_lead_feedback(lead_id);

-- RLS aus für jetzt — Phase 1 Zugriff ausschließlich via service_role (Server-Side).
-- Wenn CRK-Mitarbeiter eigene Logins kriegen sollen, später Policies hinzufügen.
ALTER TABLE crk_sources       DISABLE ROW LEVEL SECURITY;
ALTER TABLE crk_articles      DISABLE ROW LEVEL SECURITY;
ALTER TABLE crk_leads         DISABLE ROW LEVEL SECURITY;
ALTER TABLE crk_lead_feedback DISABLE ROW LEVEL SECURITY;
