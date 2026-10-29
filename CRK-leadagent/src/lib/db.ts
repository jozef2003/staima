// Supabase REST client für das Dashboard. Server-side fetch mit
// service_role key — bypassed RLS. NIEMALS client-seitig nutzen.
//
// ENV:
//   NEXT_PUBLIC_SUPABASE_URL       (öffentlich, nur Projekt-URL)
//   SUPABASE_SERVICE_ROLE_KEY      (geheim, Server-only)

export type Lead = {
  id: number
  week: string
  projekt: string
  standort: string | null
  projekttyp: string | null
  phase: string | null
  akteure: string | null
  kommunikationsbedarf: string | null
  potenzial: 'Hoch' | 'Mittel' | 'Tief' | null
  quelle: string | null
  quelle_url: string | null
  datum: string | null
  zusammenfassung: string | null
  is_duplicate: boolean | null
  confidence: string | null
  recherche_hinweis: string | null
  bauherr: string | null
  bauherr_website: string | null
  kontakt_hinweis: string | null
  aufhaenger: string | null
  ansprechpartner: string | null
  ansprechpartner_rolle: string | null
  linkedin: string | null
  kontakt_quelle: string | null
  bereits_betreut: boolean | null
  verify_note: string | null
}

export type DbStatus = 'ok' | 'no-url' | 'unreachable' | 'no-schema'

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return { url: url?.replace(/\/$/, ''), key }
}

async function sb<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = env()
  if (!url || !key) throw new Error('NO_URL')
  const r = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })
  if (!r.ok) throw new Error(`${r.status} ${await r.text().then(t => t.slice(0, 200))}`)
  return r.json() as Promise<T>
}

export type WeekInfo = { week: string; count: number }
export type FeedbackKind = 'relevant' | 'not_relevant' | 'contacted' | 'assigned'

/**
 * Holt das Briefing einer Woche. Ohne `targetWeek` die jüngste Woche mit
 * mindestens einem nicht-duplizierten Lead. Liefert zusätzlich die Liste aller
 * verfügbaren Wochen (für die Wochen-Navigation im Dashboard).
 */
export async function getBriefing(targetWeek?: string | null): Promise<{
  week: string | null
  leads: Lead[]
  weeks: WeekInfo[]
  feedback: Record<number, FeedbackKind>
  status: DbStatus
  error?: string
}> {
  const { url, key } = env()
  if (!url || !key) return { week: null, leads: [], weeks: [], feedback: {}, status: 'no-url' }

  try {
    // Alle Wochen mit nicht-duplizierten Leads holen und zu {week, count}
    // aggregieren. Datenmenge ist klein (≤30 Leads/Woche, wenige Wochen).
    const allWeeks = await sb<{ week: string }[]>(
      'crk_leads?select=week&is_duplicate=is.false&order=week.desc',
    )
    const counts = new Map<string, number>()
    for (const { week } of allWeeks) counts.set(week, (counts.get(week) ?? 0) + 1)
    const weeks: WeekInfo[] = [...counts.entries()]
      .map(([week, count]) => ({ week, count }))
      .sort((a, b) => (a.week < b.week ? 1 : -1))

    if (weeks.length === 0) return { week: null, leads: [], weeks, feedback: {}, status: 'ok' }

    // Gewünschte Woche, sonst die jüngste. Unbekannte/ungültige → jüngste.
    const week = targetWeek && counts.has(targetWeek) ? targetWeek : weeks[0].week

    // pg PostgREST sort: potenzial Hoch>Mittel>Tief via custom — einfacher
    // client-seitig, da nur ≤30 Leads/Woche.
    const leads = await sb<Lead[]>(
      `crk_leads?select=*&week=eq.${week}&is_duplicate=is.false&order=datum.desc.nullslast`,
    )
    const order: Record<string, number> = { Hoch: 0, Mittel: 1, Tief: 2 }
    leads.sort((a, b) =>
      (order[a.potenzial ?? 'Tief'] ?? 3) - (order[b.potenzial ?? 'Tief'] ?? 3),
    )

    // Bestehendes Feedback der angezeigten Leads laden, damit die Buttons
    // ihren Zustand nach Reload behalten. Jüngste Zeile pro Lead gewinnt
    // (POST erzwingt zwar eine Zeile/Lead, Altdaten können mehrere haben).
    const feedback: Record<number, FeedbackKind> = {}
    if (leads.length > 0) {
      const ids = leads.map(l => l.id).join(',')
      const fbRows = await sb<{ lead_id: number; kind: FeedbackKind }[]>(
        `crk_lead_feedback?select=lead_id,kind&lead_id=in.(${ids})&order=created_at.desc`,
      )
      for (const { lead_id, kind } of fbRows) {
        if (!(lead_id in feedback)) feedback[lead_id] = kind
      }
    }

    return { week, leads, weeks, feedback, status: 'ok' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // PGRST205 = relation/table doesn't exist — Supabase reachable, schema fehlt
    const noSchema = msg.includes('PGRST205') || msg.includes('crk_leads')
    return {
      week: null,
      leads: [],
      weeks: [],
      feedback: {},
      status: noSchema ? 'no-schema' : 'unreachable',
      error: msg,
    }
  }
}

/** @deprecated — nutze getBriefing(). Bleibt für Rückwärtskompatibilität. */
export async function getLatestBriefing() {
  const { week, leads, status, error } = await getBriefing()
  return { week, leads, status, error }
}
