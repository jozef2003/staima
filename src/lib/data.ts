import { mockClients, mockWorkflows, mockDeploymentLogs, mockInvoices, mockBots } from './mock-data'
import type { Client, Workflow, DeploymentLog, Invoice, Bot } from './supabase/types'

const useSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function getSupabase() {
  if (!useSupabase) return null
  const { supabase } = await import('./supabase/client')
  return supabase
}

export async function getClients(): Promise<Client[]> {
  const sb = await getSupabase()
  if (!sb) return mockClients
  const { data, error } = await sb.from('clients').select('*').order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function getClient(id: string): Promise<Client | null> {
  const sb = await getSupabase()
  if (!sb) return mockClients.find(c => c.id === id) || null
  const { data, error } = await sb.from('clients').select('*').eq('id', id).single()
  if (error) return null
  return data
}

export async function getClientBots(clientId: string): Promise<Bot[]> {
  const sb = await getSupabase()
  if (!sb) return mockBots.filter(b => b.client_id === clientId)
  const { data, error } = await sb.from('bots').select('*').eq('client_id', clientId).order('created_at', { ascending: true })
  if (error) { console.error('getClientBots:', error); return [] }
  return data
}

export async function getAllBots(): Promise<Bot[]> {
  const sb = await getSupabase()
  if (!sb) return mockBots
  const { data, error } = await sb.from('bots').select('*').order('created_at', { ascending: true })
  if (error) { console.error('getAllBots:', error); return [] }
  return data
}

export async function getClientWorkflows(clientId: string): Promise<Workflow[]> {
  const sb = await getSupabase()
  if (!sb) return mockWorkflows.filter(w => w.client_id === clientId)
  const { data, error } = await sb.from('workflows').select('*').eq('client_id', clientId).order('created_at', { ascending: true })
  if (error) { console.error('getClientWorkflows:', error); return [] }
  return data
}

export async function getClientDeploymentLogs(clientId: string): Promise<DeploymentLog[]> {
  const sb = await getSupabase()
  if (!sb) return mockDeploymentLogs.filter(d => d.client_id === clientId)
  const { data, error } = await sb.from('deployment_log').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
  if (error) { console.error('getClientDeploymentLogs:', error); return [] }
  return data
}

export async function getClientInvoices(clientId: string): Promise<Invoice[]> {
  const sb = await getSupabase()
  if (!sb) return mockInvoices.filter(i => i.client_id === clientId)
  const { data, error } = await sb.from('invoices').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
  if (error) { console.error('getClientInvoices:', error); return [] }
  return data
}

export async function getAllWorkflows(): Promise<Workflow[]> {
  const sb = await getSupabase()
  if (!sb) return mockWorkflows
  const { data, error } = await sb.from('workflows').select('*').order('created_at', { ascending: true })
  if (error) { console.error('getAllWorkflows:', error); return [] }
  return data
}

export async function getAllDeploymentLogs(): Promise<DeploymentLog[]> {
  const sb = await getSupabase()
  if (!sb) return mockDeploymentLogs
  const { data, error } = await sb.from('deployment_log').select('*').order('created_at', { ascending: false })
  if (error) { console.error('getAllDeploymentLogs:', error); return [] }
  return data
}

export async function getClientServers(clientId: string): Promise<{ id: string; ip: string; label: string | null; provider: string | null; status: string }[]> {
  const sb = await getSupabase()
  if (!sb) return []
  const { data, error } = await sb.from('servers').select('id, ip, label, provider, status').eq('client_id', clientId)
  if (error) { console.error('getClientServers:', error); return [] }
  return data
}

export async function getAllServers(): Promise<{ id: string; client_id: string; ip: string; label: string | null; provider: string | null; status: string }[]> {
  const sb = await getSupabase()
  if (!sb) return []
  const { data, error } = await sb.from('servers').select('*')
  if (error) { console.error('getAllServers:', error); return [] }
  return data
}

export async function getAllInvoices(): Promise<Invoice[]> {
  const sb = await getSupabase()
  if (!sb) return mockInvoices
  const { data, error } = await sb.from('invoices').select('*').order('created_at', { ascending: false })
  if (error) { console.error('getAllInvoices:', error); return [] }
  return data
}

export async function getDashboardStats() {
  const clients = await getClients()
  const bots = await getAllBots()
  const workflows = await getAllWorkflows()
  const logs = await getAllDeploymentLogs()

  const payingClients = clients.filter(c => c.industry !== 'Intern (Test)')
  const activeWorkflows = workflows.filter(w => w.status === 'active')
  const totalHoursThisWeek = logs.reduce((sum, l) => sum + l.hours_spent, 0)
  const totalHoursSavedWeekly = workflows.reduce((sum, w) => sum + (w.estimated_hours_saved_weekly || 0), 0)
  const mrr = payingClients.reduce((sum, c) => sum + c.monthly_fee, 0)
  const onlineBots = bots.filter(b => b.status === 'online')

  return {
    clients,
    bots,
    clientCount: payingClients.length,
    botCount: bots.length,
    onlineBotCount: onlineBots.length,
    mrr,
    hoursThisWeek: totalHoursThisWeek,
    activeWorkflowCount: activeWorkflows.length,
    totalHoursSavedWeekly,
    totalWorkflows: workflows.length,
    totalHoursLogged: logs.reduce((sum, l) => sum + l.hours_spent, 0),
  }
}
