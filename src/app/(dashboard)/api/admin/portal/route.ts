import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const ADMIN_DOMAIN = '@staima.ai'

async function getAdminUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST: create new portal user for a client
export async function POST(request: NextRequest) {
  const user = await getAdminUser()
  if (!user || !user.email?.endsWith(ADMIN_DOMAIN)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { clientId, email, password } = await request.json()
  if (!clientId || !email || !password) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const sb = adminClient()

  // Create auth user
  const { data: newUser, error: createError } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 })
  }

  // Link to client
  const { error: linkError } = await sb.from('clients')
    .update({ auth_user_id: newUser.user.id })
    .eq('id', clientId)
  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, userId: newUser.user.id })
}

// PATCH: update password for existing portal user
export async function PATCH(request: NextRequest) {
  const user = await getAdminUser()
  if (!user || !user.email?.endsWith(ADMIN_DOMAIN)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { userId, password } = await request.json()
  if (!userId || !password) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const sb = adminClient()
  const { error } = await sb.auth.admin.updateUserById(userId, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}

// DELETE: remove portal access
export async function DELETE(request: NextRequest) {
  const user = await getAdminUser()
  if (!user || !user.email?.endsWith(ADMIN_DOMAIN)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { clientId, userId } = await request.json()
  const sb = adminClient()

  await sb.from('clients').update({ auth_user_id: null }).eq('id', clientId)
  await sb.auth.admin.deleteUser(userId)

  return NextResponse.json({ success: true })
}
