-- Bots table: each client can have multiple bots
CREATE TYPE bot_status AS ENUM ('offline', 'configuring', 'online', 'error');

CREATE TABLE bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  bot_name TEXT NOT NULL,
  avatar_url TEXT,
  ai_model TEXT NOT NULL DEFAULT 'claude-sonnet-4',
  status bot_status NOT NULL DEFAULT 'offline',
  server_ip TEXT,
  sandbox_name TEXT,
  telegram_token TEXT,
  messaging_channel TEXT DEFAULT 'telegram',
  assigned_to TEXT,
  role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bots_client_id ON bots(client_id);

-- RLS
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON bots FOR ALL USING (true) WITH CHECK (true);

-- Seed: Marlene bot for Jozef
INSERT INTO bots (client_id, bot_name, avatar_url, ai_model, status, server_ip, sandbox_name, messaging_channel, assigned_to, role)
VALUES (
  'ba5de260-7539-4705-9554-14e526c7a7a3',
  'Marlene',
  '/marlene-avatar.jpg',
  'claude-sonnet-4',
  'online',
  '178.104.79.158',
  'marlene-jozef-test',
  'telegram',
  'Jozef Kapicak',
  'Persönliche Assistentin'
);
