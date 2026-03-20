export type ClientStatus = 'lead' | 'discovery' | 'setup' | 'live' | 'support'
export type VpsStatus = 'not_setup' | 'provisioning' | 'active' | 'maintenance' | 'offline'
export type MarleneStatus = 'not_deployed' | 'configuring' | 'active' | 'paused' | 'error'
export type WorkflowType = 'email_triage' | 'client_onboarding' | 'reporting' | 'content_pipeline' | 'lead_enrichment' | 'brand_monitoring' | 'meeting_prep' | 'custom'
export type WorkflowStatus = 'planned' | 'configuring' | 'active' | 'paused' | 'broken'
export type ActionType = 'setup' | 'config' | 'policy' | 'skill' | 'fix' | 'update' | 'handover'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue'
export type BotStatus = 'offline' | 'configuring' | 'online' | 'error'

export interface Client {
  id: string
  company_name: string
  contact_name: string
  contact_email: string
  contact_phone: string | null
  industry: string
  status: ClientStatus
  score: number
  monthly_fee: number
  setup_fee: number
  vps_provider: string | null
  vps_ip: string | null
  vps_status: VpsStatus
  sandbox_name: string | null
  messaging_channel: string | null
  marlene_status: MarleneStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Workflow {
  id: string
  client_id: string
  workflow_name: string
  workflow_type: WorkflowType
  status: WorkflowStatus
  estimated_hours_saved_weekly: number | null
  skills_used: string[] | null
  created_at: string
}

export interface DeploymentLog {
  id: string
  client_id: string
  action: string
  action_type: ActionType
  hours_spent: number
  hourly_rate: number
  billable: boolean
  notes: string | null
  created_at: string
}

export interface Invoice {
  id: string
  client_id: string
  invoice_number: string
  period_start: string
  period_end: string
  setup_amount: number
  hours_amount: number
  support_amount: number
  infra_amount: number
  total_amount: number
  status: InvoiceStatus
  created_at: string
}

export interface Bot {
  id: string
  client_id: string
  bot_name: string
  avatar_url: string | null
  ai_model: string
  status: BotStatus
  server_ip: string | null
  sandbox_name: string | null
  telegram_token: string | null
  messaging_channel: string | null
  assigned_to: string | null
  role: string | null
  gateway_url: string | null
  gateway_token: string | null
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: Client
        Insert: Omit<Client, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Client, 'id' | 'created_at' | 'updated_at'>>
      }
      bots: {
        Row: Bot
        Insert: Omit<Bot, 'id' | 'created_at'>
        Update: Partial<Omit<Bot, 'id' | 'created_at'>>
      }
      workflows: {
        Row: Workflow
        Insert: Omit<Workflow, 'id' | 'created_at'>
        Update: Partial<Omit<Workflow, 'id' | 'created_at'>>
      }
      deployment_log: {
        Row: DeploymentLog
        Insert: Omit<DeploymentLog, 'id' | 'created_at'>
        Update: Partial<Omit<DeploymentLog, 'id' | 'created_at'>>
      }
      invoices: {
        Row: Invoice
        Insert: Omit<Invoice, 'id' | 'created_at'>
        Update: Partial<Omit<Invoice, 'id' | 'created_at'>>
      }
    }
  }
}
