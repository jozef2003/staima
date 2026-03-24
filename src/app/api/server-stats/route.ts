import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const statsUrl = req.nextUrl.searchParams.get('url')
  if (!statsUrl) return NextResponse.json({ error: 'url required' }, { status: 400 })
  try {
    const res = await fetch(statsUrl, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return NextResponse.json({ error: 'unreachable' }, { status: 502 })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ error: 'unreachable' }, { status: 502 })
  }
}
