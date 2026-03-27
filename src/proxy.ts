import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes — no auth needed
  if (pathname.startsWith('/login') || pathname.startsWith('/_next') || pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const isAdmin = user.email === 'jozef@staima.ai'
  if (isAdmin) return response

  // Client user: look up their client_id
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!client) {
    return NextResponse.redirect(new URL('/login?error=no_client', request.url))
  }

  const allowed = `/clients/${client.id}`

  if (pathname === '/') return NextResponse.redirect(new URL(allowed, request.url))

  if (pathname.startsWith('/clients/') && !pathname.startsWith(allowed)) {
    return NextResponse.redirect(new URL(allowed, request.url))
  }

  if (['/revenue', '/servers', '/playbook'].some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL(allowed, request.url))
  }

  return response
}
