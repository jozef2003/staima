import { NextRequest, NextResponse } from 'next/server'

const KINDS = ['relevant', 'not_relevant', 'contacted', 'assigned'] as const
type Kind = (typeof KINDS)[number]

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return { url, key }
}

function sbHeaders(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Setzt das Feedback eines Leads. EINE Bewertung pro Lead: vorhandene Zeilen
 * werden gelöscht, dann die neue eingefügt — so ersetzt ein Wechsel (👍→👎)
 * sauber statt zu addieren, und der Scorer-Prompt bekommt kein
 * widersprüchliches Signal.
 */
export async function POST(req: NextRequest) {
  const { url, key } = env()
  if (!url || !key) {
    return NextResponse.json({ error: 'supabase env missing' }, { status: 500 })
  }

  let body: { lead_id?: number; kind?: string; note?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const { lead_id, kind, note } = body
  if (!lead_id || !kind || !KINDS.includes(kind as Kind)) {
    return NextResponse.json({ error: 'lead_id + valid kind required' }, { status: 400 })
  }

  // Erst alte Bewertungen dieses Leads entfernen (eine Bewertung pro Lead)
  await fetch(`${url}/rest/v1/crk_lead_feedback?lead_id=eq.${lead_id}`, {
    method: 'DELETE',
    headers: sbHeaders(key),
  })

  const r = await fetch(`${url}/rest/v1/crk_lead_feedback`, {
    method: 'POST',
    headers: { ...sbHeaders(key), Prefer: 'return=representation' },
    body: JSON.stringify({ lead_id, kind, note: note || null }),
  })
  if (!r.ok) {
    const text = await r.text()
    return NextResponse.json({ error: text.slice(0, 300) }, { status: r.status })
  }
  return NextResponse.json({ ok: true })
}

/**
 * Hebt das Feedback eines Leads auf (Toggle-off). Body: { lead_id }.
 */
export async function DELETE(req: NextRequest) {
  const { url, key } = env()
  if (!url || !key) {
    return NextResponse.json({ error: 'supabase env missing' }, { status: 500 })
  }

  let body: { lead_id?: number } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const { lead_id } = body
  if (!lead_id) {
    return NextResponse.json({ error: 'lead_id required' }, { status: 400 })
  }

  const r = await fetch(`${url}/rest/v1/crk_lead_feedback?lead_id=eq.${lead_id}`, {
    method: 'DELETE',
    headers: sbHeaders(key),
  })
  if (!r.ok) {
    const text = await r.text()
    return NextResponse.json({ error: text.slice(0, 300) }, { status: r.status })
  }
  return NextResponse.json({ ok: true })
}
