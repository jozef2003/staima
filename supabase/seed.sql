-- Seed Data for Staima Dashboard

-- Client 1: Marketing Agentur
INSERT INTO clients (id, company_name, contact_name, contact_email, contact_phone, industry, status, score, monthly_fee, setup_fee, vps_provider, vps_ip, vps_status, sandbox_name, messaging_channel, marlene_status, notes)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Digital Dynamik GmbH',
  'Sarah Weber',
  'sarah@digitaldynamik.de',
  '+49 170 1234567',
  'Marketing Agentur',
  'live',
  80,
  350.00,
  2500.00,
  'Hetzner',
  '49.13.42.187',
  'active',
  'digital-dynamik-prod',
  'slack',
  'active',
  'Erster Referenz-Kunde. Sehr zufrieden mit E-Mail Triage und Weekly Reporting.'
);

-- Client 2: Performance Agentur
INSERT INTO clients (id, company_name, contact_name, contact_email, contact_phone, industry, status, score, monthly_fee, setup_fee, vps_provider, vps_ip, vps_status, sandbox_name, messaging_channel, marlene_status, notes)
VALUES (
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'Klickstark Media',
  'Tim Brandt',
  'tim@klickstark.io',
  '+49 151 9876543',
  'Performance Agentur',
  'setup',
  40,
  500.00,
  3000.00,
  'DigitalOcean',
  '167.71.55.23',
  'provisioning',
  'klickstark-staging',
  'telegram',
  'configuring',
  'Will Lead Enrichment + Content Pipeline. VPS wird gerade aufgesetzt.'
);

-- Client 3: Arztpraxis
INSERT INTO clients (id, company_name, contact_name, contact_email, industry, status, score, monthly_fee, setup_fee, vps_provider, vps_status, messaging_channel, marlene_status, notes)
VALUES (
  'c3d4e5f6-a7b8-9012-cdef-123456789012',
  'Praxis Dr. Hoffmann',
  'Dr. Lisa Hoffmann',
  'praxis@dr-hoffmann.de',
  'Arztpraxis',
  'discovery',
  10,
  200.00,
  1500.00,
  'Contabo',
  'not_setup',
  'whatsapp',
  'not_deployed',
  'Interessiert an Terminverwaltung und Patienten-Kommunikation über WhatsApp.'
);

-- Workflows for Client 1
INSERT INTO workflows (client_id, workflow_name, workflow_type, status, estimated_hours_saved_weekly, skills_used)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'E-Mail Triage', 'email_triage', 'active', 5.0, ARRAY['gmail-reader', 'slack-poster', 'text-classifier']),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Weekly Report', 'reporting', 'active', 3.0, ARRAY['data-aggregator', 'report-generator', 'slack-poster']),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Meeting Prep', 'meeting_prep', 'configuring', 2.0, ARRAY['calendar-reader', 'web-researcher', 'briefing-writer']);

-- Workflows for Client 2
INSERT INTO workflows (client_id, workflow_name, workflow_type, status, estimated_hours_saved_weekly, skills_used)
VALUES
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Lead Enrichment', 'lead_enrichment', 'planned', 4.0, ARRAY['crm-connector', 'web-scraper', 'data-enricher']),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Content Pipeline', 'content_pipeline', 'planned', 6.0, ARRAY['content-writer', 'image-generator', 'social-poster']);

-- Deployment Log
INSERT INTO deployment_log (client_id, action, action_type, hours_spent, hourly_rate, billable, notes)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Discovery Call durchgeführt', 'setup', 1.5, 80, false, 'Erstgespräch, Anforderungen aufgenommen'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Hetzner VPS aufgesetzt', 'setup', 2.0, 80, true, 'Ubuntu 22.04, 4GB RAM, NemoClaw installiert'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'NemoClaw installiert', 'setup', 1.0, 80, true, 'Sandbox erstellt und konfiguriert'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'E-Mail Triage konfiguriert', 'config', 3.0, 80, true, 'Gmail OAuth + Slack Webhook + Classifier'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Weekly Reporting aufgesetzt', 'skill', 2.5, 80, true, 'Daten-Quellen angebunden, Template erstellt'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Policy Update', 'policy', 0.5, 80, true, 'Netzwerk-Policies angepasst'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Team-Übergabe', 'handover', 2.0, 80, true, 'Team eingewiesen, Doku übergeben'),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Discovery Call durchgeführt', 'setup', 1.0, 80, false, NULL),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'VPS Setup gestartet', 'setup', 1.5, 80, true, 'DigitalOcean Droplet erstellt'),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'Erstgespräch geplant', 'setup', 0.5, 80, false, 'Termin für Discovery Call vereinbart');

-- Invoice for Client 1
INSERT INTO invoices (client_id, invoice_number, period_start, period_end, setup_amount, hours_amount, support_amount, infra_amount, total_amount, status)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'STM-2026-001', '2026-01-01', '2026-01-31', 2500.00, 720.00, 350.00, 15.00, 3585.00, 'paid'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'STM-2026-002', '2026-02-01', '2026-02-28', 0.00, 200.00, 350.00, 15.00, 565.00, 'sent');
