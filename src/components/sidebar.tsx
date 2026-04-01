'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Server, Menu, X, LogOut, BookOpen } from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/servers', label: 'Server', icon: Server },
  { href: '/playbook', label: 'Playbook', icon: BookOpen },
]

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAdmin(user?.email?.endsWith('@staima.ai') ?? false)
    })
  }, [])

  // Don't render nav until we know who the user is
  if (isAdmin === null) return null

  return (
    <>
      {/* Mobile toggle — only for admin */}
      {isAdmin && (
        <button
          onClick={() => setOpen(!open)}
          className="fixed top-4 left-4 z-50 md:hidden rounded-lg bg-card p-2 border border-border"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      )}

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-sidebar transition-transform duration-200 md:static md:translate-x-0',
          isAdmin ? 'w-64' : 'w-16',
          open ? 'translate-x-0' : isAdmin ? '-translate-x-full md:translate-x-0' : 'translate-x-0'
        )}
      >
        {/* Logo */}
        <div className={cn('flex items-center border-b border-border px-4 py-5', isAdmin ? 'gap-3 px-6' : 'justify-center')}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg shrink-0">
            S
          </div>
          {isAdmin && (
            <div>
              <h1 className="text-lg font-bold text-foreground tracking-tight">Staima</h1>
              <p className="text-[11px] text-muted-foreground">Dashboard</p>
            </div>
          )}
        </div>

        {/* Nav — admin only */}
        {isAdmin && (
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navItems.map((item) => {
              const isActive = item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        )}

        {/* Bottom */}
        <div className={cn('border-t border-border py-4 space-y-2', isAdmin ? 'px-4' : 'px-2 flex flex-col items-center')}>
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/login'
            }}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors w-full justify-start"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            {isAdmin && 'Logout'}
          </button>
          {isAdmin && <span className="text-xs text-muted-foreground/50 px-3">v1.0</span>}
        </div>
      </aside>
    </>
  )
}
