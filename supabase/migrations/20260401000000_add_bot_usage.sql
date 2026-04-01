CREATE TABLE IF NOT EXISTS bot_usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id uuid REFERENCES bots(id) ON DELETE CASCADE,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cache_read_tokens integer NOT NULL DEFAULT 0,
  cache_creation_tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric(10,6) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_usage_bot_date ON bot_usage(bot_id, created_at);

ALTER TABLE bot_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON bot_usage FOR ALL USING (true);
