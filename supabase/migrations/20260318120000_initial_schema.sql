-- Staima Client Management Dashboard - Supabase Schema
-- Run this in your Supabase SQL Editor

-- Enums
CREATE TYPE client_status AS ENUM ('lead', 'discovery', 'setup', 'live', 'support');
CREATE TYPE vps_status AS ENUM ('not_setup', 'provisioning', 'active', 'maintenance', 'offline');
CREATE TYPE marlene_status AS ENUM ('not_deployed', 'configuring', 'active', 'paused', 'error');
CREATE TYPE workflow_type AS ENUM ('email_triage', 'client_onboarding', 'reporting', 'content_pipeline', 'lead_enrichment', 'brand_monitoring', 'meeting_prep', 'custom');
CREATE TYPE workflow_status AS ENUM ('planned', 'configuring', 'active', 'paused', 'broken');
CREATE TYPE action_type AS ENUM ('setup', 'config', 'policy', 'skill', 'fix', 'update', 'handover');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue');

-- Clients Table
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  industry TEXT NOT NULL,
  status client_status NOT NULL DEFAULT 'lead',
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  monthly_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
  setup_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
  vps_provider TEXT,
  vps_ip TEXT,
  vps_status vps_status NOT NULL DEFAULT 'not_setup',
  sandbox_name TEXT,
  messaging_channel TEXT,
  marlene_status marlene_status NOT NULL DEFAULT 'not_deployed',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Workflows Table
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  workflow_name TEXT NOT NULL,
  workflow_type workflow_type NOT NULL DEFAULT 'custom',
  status workflow_status NOT NULL DEFAULT 'planned',
  estimated_hours_saved_weekly DECIMAL(5, 1),
  skills_used TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deployment Log Table
CREATE TABLE deployment_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  action_type action_type NOT NULL DEFAULT 'setup',
  hours_spent DECIMAL(5, 2) NOT NULL DEFAULT 0,
  hourly_rate DECIMAL(6, 2) NOT NULL DEFAULT 80,
  billable BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invoices Table
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  setup_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  hours_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  support_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  infra_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status invoice_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_workflows_client_id ON workflows(client_id);
CREATE INDEX idx_deployment_log_client_id ON deployment_log(client_id);
CREATE INDEX idx_invoices_client_id ON invoices(client_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Policies: Authenticated users can do everything
CREATE POLICY "Authenticated users full access" ON clients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users full access" ON workflows
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users full access" ON deployment_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users full access" ON invoices
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
