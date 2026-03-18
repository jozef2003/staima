# Staima – Mission Control 🦞

Client Management Dashboard für OpenClaw/NemoClaw Consulting, powered by Marlene.

## Tech Stack

- **Next.js 14+** (App Router)
- **TypeScript**
- **Tailwind CSS** + shadcn/ui
- **Supabase** (Auth + Datenbank)
- **Vercel** Deployment

## Setup

### 1. Dependencies installieren

```bash
npm install
```

### 2. Supabase einrichten

1. Erstelle ein neues Projekt auf [supabase.com](https://supabase.com)
2. Führe `supabase/schema.sql` im SQL Editor aus
3. Optional: Führe `supabase/seed.sql` für Testdaten aus
4. Kopiere `.env.example` zu `.env.local` und fülle die Werte:

```bash
cp .env.example .env.local
```

### 3. Entwicklungsserver starten

```bash
npm run dev
```

Die App startet auf [http://localhost:3000](http://localhost:3000).

**Ohne Supabase:** Die App funktioniert auch ohne Supabase-Konfiguration mit Mock-Daten.

### 4. Vercel Deployment

```bash
vercel
```

Setze die Environment Variables in den Vercel Project Settings.

## Projektstruktur

```
src/
├── app/
│   ├── page.tsx              # Dashboard / Mission Control
│   ├── clients/
│   │   ├── [id]/page.tsx     # Client Detail (Tabs)
│   │   └── new/page.tsx      # Neuer Client
│   ├── revenue/page.tsx      # Revenue Übersicht
│   └── playbook/page.tsx     # Consulting Playbook
├── components/
│   ├── ui/                   # shadcn/ui Komponenten
│   ├── client/               # Client Detail Tab-Komponenten
│   ├── sidebar.tsx
│   ├── client-card.tsx
│   ├── stat-card.tsx
│   └── level-display.tsx
└── lib/
    ├── supabase/             # Supabase Client & Types
    ├── data.ts               # Data Access Layer
    ├── mock-data.ts          # Mock-Daten für Entwicklung
    └── constants.ts          # Level-System, Checklists, etc.
```
