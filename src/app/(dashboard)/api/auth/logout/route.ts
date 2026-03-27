import { NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase/ssr-client'

export async function POST() {
  const supabase = await createAuthClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'))
}
