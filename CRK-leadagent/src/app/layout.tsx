import './globals.css'
import type { Metadata } from 'next'
import { Open_Sans } from 'next/font/google'

const openSans = Open_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-open-sans',
})

export const metadata: Metadata = {
  title: 'Sämi — CRK Lead Briefing',
  description: 'Tägliches Lead-Briefing für CRK',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={openSans.variable}>
      <body>{children}</body>
    </html>
  )
}
