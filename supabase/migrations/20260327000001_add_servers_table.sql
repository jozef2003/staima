CREATE TABLE IF NOT EXISTS servers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  ip text NOT NULL,
  label text,
  provider text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE servers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON servers FOR ALL USING (true) WITH CHECK (true);
