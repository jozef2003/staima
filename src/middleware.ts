import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes
  if (pathname.startsWith('/login') || pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Client users: redirect / to their own client page
  if (pathname === '/' && user.email !== 'jozef@staima.ai') {
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (client) {
      return NextResponse.redirect(new URL(`/clients/${client.id}`, request.url))
    }
    // No client found → back to login with error
    return NextResponse.redirect(new URL('/login?error=no_client', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
