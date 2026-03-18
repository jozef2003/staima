export const CLIENT_STATUSES = [
  { value: 'lead', label: 'Lead', color: 'bg-zinc-500' },
  { value: 'discovery', label: 'Discovery', color: 'bg-blue-500' },
  { value: 'setup', label: 'Setup', color: 'bg-amber-500' },
  { value: 'live', label: 'Live', color: 'bg-teal-500' },
  { value: 'support', label: 'Support', color: 'bg-purple-500' },
] as const

export const WORKFLOW_TYPES = [
  { value: 'email_triage', label: 'E-Mail Triage', description: 'Gmail/Outlook → Slack Summary' },
  { value: 'client_onboarding', label: 'Client Onboarding', description: 'Trigger → Folder + Mail + CRM + Calendar' },
  { value: 'reporting', label: 'Weekly Reporting', description: 'Daten sammeln → Report → Slack/Mail' },
  { value: 'content_pipeline', label: 'Content Pipeline', description: 'Briefing → Draft → Review Queue' },
  { value: 'lead_enrichment', label: 'Lead Enrichment', description: 'Neue Leads → Anreicherung → CRM' },
  { value: 'brand_monitoring', label: 'Brand Monitoring', description: 'X/Social → Sentiment → Alert' },
  { value: 'meeting_prep', label: 'Meeting Prep', description: 'Calendar → Research → Briefing' },
  { value: 'custom', label: 'Custom', description: 'Individueller Workflow' },
] as const

export const LEVELS = [
  { min: 0, max: 2, level: 1, name: 'Starter', emoji: '🚀' },
  { min: 3, max: 4, level: 2, name: 'Builder', emoji: '🔧' },
  { min: 5, max: 6, level: 3, name: 'Operator', emoji: '⚡' },
  { min: 7, max: 8, level: 4, name: 'Scale Machine', emoji: '🏗️' },
  { min: 9, max: 10, level: 5, name: 'Scale Machine', emoji: '👑' },
] as const

export const ONBOARDING_CHECKLIST = [
  'Discovery Call abgeschlossen',
  'Infrastruktur geklärt (VPS/Hardware)',
  'NemoClaw installiert',
  'Sandbox konfiguriert',
  'Messaging Channel verbunden',
  'Erster Workflow live',
  'Team-Übergabe gemacht',
  'Dokumentation übergeben',
  '30-Tage Support gestartet',
  'Client zufrieden (Feedback)',
] as const

export const MAX_CLIENTS = 10

export function getLevel(clientCount: number) {
  return LEVELS.find(l => clientCount >= l.min && clientCount <= l.max) || LEVELS[0]
}

export function getXP(stats: { clients: number; workflows: number; hoursLogged: number }) {
  return stats.clients * 100 + stats.workflows * 25 + Math.floor(stats.hoursLogged * 10)
}

export function getXPForNextLevel(currentLevel: number) {
  return currentLevel * 500
}
