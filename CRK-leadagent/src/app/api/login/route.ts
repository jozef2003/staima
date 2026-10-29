import { NextResponse } from 'next/server'
import { AUTH_COOKIE, authConfig, tokenFor } from '@/lib/auth'

export async function POST(req: Request) {
  let body: { password?: string } = {}
  try {
    body = await req.json()
  } catch {}

  const cfg = authConfig()
  if (cfg.pass && body.password && body.password === cfg.pass) {
    const res = NextResponse.json({ ok: true })
    res.cookies.set(AUTH_COOKIE, await tokenFor(cfg.pass), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 Tage
    })
    return res
  }

  return NextResponse.json({ ok: false, error: 'Falsches Passwort.' }, { status: 401 })
}
