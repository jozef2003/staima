-- Add auth_user_id to clients table for client portal login
ALTER TABLE clients ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS clients_auth_user_id_idx ON clients(auth_user_id);
