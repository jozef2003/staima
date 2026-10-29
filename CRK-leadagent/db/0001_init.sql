-- CRK Lead Agent — initial schema
-- Sources of truth: articles (raw crawl) → leads (classified + scored)

CREATE TABLE IF NOT EXISTS sources (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,          -- 'baublatt' | 'nzz' | ...
  kind       TEXT NOT NULL,                  -- 'news' | 'branch' | 'linkedin' | 'study'
  url        TEXT NOT NULL,
  last_crawl TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS articles (
  id          BIGSERIAL PRIMARY KEY,
  source_id   INT  REFERENCES sources(id),
  url         TEXT NOT NULL UNIQUE,
  title       TEXT,
  published   TIMESTAMPTZ,
  fulltext    TEXT,
  fetched_at  TIMESTAMPTZ DEFAULT now(),

  -- classification results (filled by pipeline)
  is_relevant BOOLEAN,
  reasoning   TEXT,
  entities    JSONB,           -- {projekt, ort, kanton, akteure[]}

  CONSTRAINT title_or_text CHECK (title IS NOT NULL OR fulltext IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published DESC);
CREATE INDEX IF NOT EXISTS idx_articles_relevant ON articles(is_relevant) WHERE is_relevant = true;

CREATE TABLE IF NOT EXISTS leads (
  id                    BIGSERIAL PRIMARY KEY,
  week                  DATE NOT NULL,   -- ISO Monday — groups leads per briefing
  article_id            BIGINT REFERENCES articles(id),

  -- the 10 fields from the briefing template
  projekt               TEXT NOT NULL,
  standort              TEXT,             -- 'Winterthur, ZH'
  projekttyp            TEXT,             -- 'Areal-Entwicklung' | 'Leerkündigung' | ...
  phase                 TEXT,             -- 'Planung' | 'Bewilligung' | ...
  akteure               TEXT,
  kommunikationsbedarf  TEXT,
  potenzial             TEXT CHECK (potenzial IN ('Hoch','Mittel','Tief')),
  quelle                TEXT,
  quelle_url            TEXT,
  datum                 DATE,
  zusammenfassung       TEXT,

  -- dedup fingerprint — same project across weeks gets the same hash
  fingerprint           TEXT,

  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_week ON leads(week DESC);
CREATE INDEX IF NOT EXISTS idx_leads_fingerprint ON leads(fingerprint);

CREATE TABLE IF NOT EXISTS feedback (
  id         BIGSERIAL PRIMARY KEY,
  lead_id    BIGINT REFERENCES leads(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('relevant','not_relevant','contacted','assigned')),
  note       TEXT,
  user_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_lead ON feedback(lead_id);
