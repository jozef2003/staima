# Staima Dashboard — Projektübersicht für Claude

## Was ist das hier?
Staima ist Jozefs AI-Agentur-Dashboard. Es verwaltet Kunden, Bots und Workflows.
Das Dashboard ist ein **Next.js 15 App Router** Projekt mit **Supabase** als Datenbank.
Jozef steuert alles vom Handy — Antworten kurz und direkt halten.

---

## Tech Stack
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, shadcn/ui
- **Datenbank**: Supabase (PostgreSQL + RLS)
- **Bots**: OpenClaw Gateway (WebSocket-Protokoll) + NemoClaw Sandbox
- **Server**: Hetzner VPS `159.69.221.169` (Sietch + Nora laufen dort)
- **Bot-Framework**: OpenClaw (eigenes Protokoll, kein Standard-WS-API)

---

## Projektstruktur
```
src/
  app/
    page.tsx                    # Dashboard-Startseite (Übersicht + Statistiken)
    clients/[id]/page.tsx       # Client-Detailseite (Tabs: Übersicht, Agent, Chat, Skills, Aktivitäten, Rechnungen)
    api/bot-chat/route.ts       # WebSocket-Proxy für OpenClaw Bot-Chat
  components/
    client/
      client-overview.tsx       # Bot-Karten + Server-Status
      client-marlene.tsx        # Organigramm + Bot hinzufügen
      client-chat.tsx           # Live-Chat mit Bots via OpenClaw
      client-workflows.tsx      # Workflows/Skills Tab
      client-time-tracking.tsx  # Deployment Log / Aktivitäten
      client-invoices.tsx       # Rechnungen
  lib/
    data.ts                     # Alle Supabase-Queries (returns [] statt throw bei Fehler)
    mock-data.ts                # Fallback-Daten wenn kein Supabase
    supabase/
      client.ts                 # Supabase Client
      types.ts                  # TypeScript-Typen (Client, Bot, Workflow, etc.)
bots/
  sietch/                       # Sietch Bot (auf Server: /opt/sietch/)
    get_oauth_token.py          # OAuth-Flow für Google-APIs (einmalig lokal ausführen)
  lead-scraper/                 # Fabio Bot (Lead-Scraper)
supabase/
  migrations/                   # Alle DB-Migrationen (in Reihenfolge ausführen)
```

---

## Bots auf dem Server (159.69.221.169)

| Bot | Sandbox | Port | Gateway URL | Status |
|-----|---------|------|-------------|--------|
| Sietch | `sietch` | 8080 | `https://myty.agency/bots/sietch` | Online |
| Nora | `nora` | 8081 | `https://myty.agency/bots/nora` | Online |

**Wichtige Server-Pfade:**
- NemoClaw Config: `/root/.nemoclaw/sandboxes.json`
- Sietch OpenClaw Config: `/opt/sietch/.openclaw/openclaw.json`
- Nora OpenClaw Config: `/opt/nora/.openclaw/openclaw.json`
- SECURITY.md (Prompt Injection Schutz): `/opt/sietch/.openclaw/workspace/SECURITY.md` (und nora)

---

## OpenClaw WebSocket-Protokoll (wichtig!)
Das Bot-Chat (`/api/bot-chat/route.ts`) nutzt ein eigenes Protokoll:

1. Server sendet `{type:"event", event:"connect.challenge", payload:{nonce:"..."}}`
2. Client antwortet mit `{type:"req", id:"1", method:"connect", params:{...}}`
3. Server antwortet `{type:"res", id:"1", ok:true, payload:{snapshot:{sessionDefaults:{mainSessionKey:"agent:main:main"}}}}`
4. Client sendet `{type:"req", id:"2", method:"chat.send", params:{sessionKey, message, ...}}`
5. Server streamt `{type:"event", event:"chat", payload:{state:"delta"/"final"/"aborted",...}}`

**Kritische Details:**
- IDs müssen **Strings** sein, nicht Integers
- `device` muss ein Objekt sein (nicht null) — `dangerouslyDisableDeviceAuth: true` in openclaw.json umgeht ECDSA-Signierung
- Node.js ws sendet keinen Origin-Header — wird explizit gesetzt: `headers: { Origin: "https://myty.agency" }`
- `dangerouslyAllowHostHeaderOriginFallback: true` in openclaw.json erlaubt Host-Header als Origin-Fallback
- Session Key default: `"agent:main:main"`

---

## Supabase-Tabellen
- `clients` — Kundenliste
- `bots` — Bots pro Client (mit `gateway_url`, `gateway_token` seit Migration `20260320`)
- `workflows` — Skills/Workflows
- `deployment_log` — Aktivitätslog (Stunden, Kosten)
- `invoices` — Rechnungen

RLS ist aktiv, aber alle Tabellen haben offene `"Allow all access"` Policy (Single-User-App).

---

## Sicherheits-Setup (MyTy Security Framework)
Was bereits umgesetzt ist:
- ✅ `claude_code` Policy **entfernt** aus beiden Sandboxen (Sietch + Nora) — Bots können keine Shell-Befehle ausführen
- ✅ SECURITY.md in Workspace beider Bots — Prompt Injection Schutz
- ✅ Output-Filter in `/api/bot-chat/route.ts` — blockiert API Keys, Bearer Tokens, Passwörter in Bot-Antworten
- ✅ Sandboxes isoliert via NemoClaw

Was noch fehlt (mittlere Priorität):
- Budget-Caps für Anthropic API
- API Keys in Secrets Manager statt Plaintext

---

## Bekannte Probleme / Offene Punkte

### Gmail — Falsche Mailbox
Sietch liest `jkapicak3@gmail.com` statt `sietch@myty.agency`.
**Ursache:** OAuth-Token wurde mit falschem Google-Account erstellt.
**Fix-Optionen:**
1. Fabians Google-Account-Passwort → `get_oauth_token.py` lokal ausführen → Token hochladen
2. Service Account + Domain-Wide Delegation (kein Passwort nötig, aber IT-Admin muss in Google Workspace Konsole einrichten)

### Service Account Setup (wenn IT-Admin verfügbar)
IT-Admin muss in Google Workspace Admin (admin.google.com):
1. Service Account in GCP erstellen → JSON-Key exportieren
2. In Admin-Konsole → Sicherheit → API-Steuerung → Domain-Wide Delegation → Client-ID + Scopes eintragen
3. JSON-Key-Datei an Jozef senden

---

## Development
```bash
npm run dev        # Lokaler Dev-Server auf :3000
npm run build      # Production Build
```

Env-Variablen (`.env.local`):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Ohne Supabase-Env-Variablen laufen alle Queries gegen `mock-data.ts`.

---

## Wichtige Verhaltensregeln für Claude
- Antworten kurz und direkt — Jozef liest vom Handy
- Direkt umsetzen, nicht zu viel fragen
- Kein unnötiges Refactoring
- Fehler in `data.ts` → `console.error` + leeres Array zurückgeben (nicht `throw`)
