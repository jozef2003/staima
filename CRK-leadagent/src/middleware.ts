import { NextRequest, NextResponse } from 'next/server'
import { AUTH_COOKIE, authConfig, tokenFor } from '@/lib/auth'

/**
 * Passwortschutz fürs ganze Dashboard über eine eigene Login-Seite (Cookie-Session).
 * Ohne gültiges Cookie → Redirect auf /login. Fail-closed: ohne gesetztes Passwort
 * ist alles gesperrt. Login-Seite + Login-API sind immer erreichbar.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/login') || pathname.startsWith('/api/login')) {
    return NextResponse.next()
  }

  const { pass } = authConfig()
  const cookie = req.cookies.get(AUTH_COOKIE)?.value
  if (pass && cookie && cookie === (await tokenFor(pass))) {
    return NextResponse.next()
  }

  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  if (pathname && pathname !== '/') url.searchParams.set('from', pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)'],
}
