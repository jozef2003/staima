-- Add mission and budget fields to bots table
ALTER TABLE bots ADD COLUMN IF NOT EXISTS mission text;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS budget_cap numeric(10,2);
ALTER TABLE bots ADD COLUMN IF NOT EXISTS monthly_spend numeric(10,2) DEFAULT 0;
