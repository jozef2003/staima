-- Add Fabio (Lead Scraper) bot under Marlene for Jozef's client
INSERT INTO bots (client_id, bot_name, avatar_url, ai_model, status, server_ip, sandbox_name, messaging_channel, assigned_to, role)
VALUES (
  'ba5de260-7539-4705-9554-14e526c7a7a3',
  'Fabio',
  '/fabio-avatar.jpg',
  'claude-sonnet-4',
  'online',
  '178.104.79.158',
  'lead-scraper-prod',
  'telegram',
  'Marlene',
  'Sales Bot - Findet täglich 20 qualitative Firmen-Leads (Anwälte, Ärzte, Immobilien, Steuerberater, Handwerk, Mittelstand) und schreibt sie ins Google Sheet.'
);
