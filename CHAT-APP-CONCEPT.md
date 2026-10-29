# Staima Chat — Konzept (reliable Bot-Chat statt Telegram)

**Ziel:** Eigene Chat-App (Web/PWA, später native) für 1:1- + Gruppenchats mit
Claude-Code-Bots. So reliable wie das Terminal, DSGVO-konform, Telegram raus.

## Warum reliable (Terminal-Prinzip 1:1 nachgebaut)
Jede Nachricht = ein abgeschlossener `claude -p --resume <session>`-Lauf.
**Kein Dauer-Socket** (= Telegrams Schwachstelle: `getUpdates`-Polling + fragiles
Plugin). Session-State liegt persistent auf Disk/DB, Retries, Queue gegen
Kollisionen. Claude selbst failt fast nie — die Flakiness war immer das Transport.

## Architektur
```
PWA Chat-UI (Next.js, im Staima-Dashboard)
   │  HTTPS / WebSocket  (Bearer-Auth)
Bridge-API (Hetzner, EU)  ── Auth · Räume · Queue · Verlauf→Supabase
   │  spawnt pro Nachricht
claude -p --resume <session>   (Workspace, Memory, Tools, Voice/Bild optional)
   │
LLM-Backend:  Anthropic-API   ODER   Bedrock/Vertex EU-Region (Frankfurt)
```
- **Bot** = Workspace + feste Session-ID
- **1:1** = 1 Session pro User↔Bot · **Gruppe** = 1 geteilter Raum, Bot bei @mention
- Push via Web-Push

## Stack (nutzt, was du schon hast)
- **Frontend:** Next.js 16 + Tailwind, PWA-Manifest → „zum Homescreen"
- **Backend:** Bridge auf Hetzner (Surfer-Bridge erweitert um HTTP-API), systemd
- **DB/Auth:** Supabase EU (Postgres + RLS + Auth)
- **LLM:** Phase 1 Anthropic-API + DPA · Phase 2 Bedrock EU für Kundendaten
  (`CLAUDE_CODE_USE_BEDROCK=1`)
- **Voice:** faster-whisper (lokal, läuft) · **Bild:** banana (läuft)

## DSGVO-Checkliste
- [ ] Hosting EU (Hetzner ✓, Supabase EU-Region wählen)
- [ ] LLM EU-Region (Bedrock/Vertex Frankfurt) für Kundendaten — Phase 2
- [ ] AV-Verträge (DPA): Anthropic, Hetzner, Supabase
- [ ] Zero-Data-Retention bei Anthropic aktivieren
- [ ] Echte Auth + RLS pro Raum (statt offener „Allow all"-Policy)
- [ ] Secrets in Manager statt Plaintext
- [ ] TLS (✓) + Verschlüsselung at-rest (Postgres ✓)
- [ ] Lösch-/Auskunftsrecht (Verlauf löschbar), Retention-Policy
- [ ] Datenschutzerklärung + Einwilligung der Endnutzer

## Aufwand (grob)
| Schritt | Aufwand |
|---|---|
| Prototyp 1:1-Chat (Bridge-HTTP-API + Chat-UI, 1 Bot) | ~0.5–1 Tag |
| Gruppen-Räume + @mention | ~1 Tag |
| Voice + Bild integriert | ~0.5 Tag |
| Auth + RLS + EU-LLM-Routing (prod-ready) | ~1–2 Tage |
| DSGVO-Doku/Verträge | Orga-Aufwand (mit Vorlagen) |

## Kosten (laufend, grob)
- Hetzner: läuft schon · Supabase Pro ~25 $/mo · LLM: nutzungsbasiert (wie jetzt)
- Bedrock EU (Phase 2): ähnlicher Tokenpreis + AWS-Konto

## Phasen
1. **Prototyp:** stabiler 1:1-Chat im Dashboard über Bridge ← *jetzt*
2. Gruppen + Voice/Bild
3. Auth + RLS + EU-LLM + DSGVO-Härtung → Kunden-ready
