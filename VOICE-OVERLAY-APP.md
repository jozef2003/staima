# Voice Overlay App — Setup & Konzept

## Idee
Mini-Overlay-Icon unten rechts auf dem Desktop. Push-to-talk → Sprachbefehl → Claude Code / OpenClaw führt aus → Sprachantwort zurück.

**Beispiel-Befehle:**
- "Schreib der Person X auf Telegram dass..."
- "Check meine Emails"
- "Was steht heute im Kalender?"
- "Erstell einen Clip aus dem letzten Podcast"

---

## Tech Stack

**Frontend / Overlay App:** Tauri (Rust + Web)
- Klein (~5MB), nativ-feel, always-on-top Menu Bar Icon
- Alternative: Swift macOS Menu Bar App (noch nativer, mehr Aufwand)
- Global Hotkey für Push-to-talk (z.B. ⌘+Space halten)

**Speech-to-Text:** OpenAI Whisper API
- API Key bereits vorhanden (`OPENAI_API_KEY`)
- ~$0.006/min, sehr schnell

**Backend (Befehle ausführen):**
- **Option A — Claude Code lokal:** `claude --print "befehl"` → kann shell, files, alle MCPs
- **Option B — OpenClaw Gateway remote:** WebSocket zu Silver Surfer / Sietch → schon konfiguriert mit Tools (Gmail, Calendar, Telegram)
- Empfohlen: **Beides möglich**, Toggle in Settings

**Text-to-Speech:** OpenAI TTS (`tts-1`) oder macOS `say`
- OpenAI TTS klingt natürlicher (~$15/1M chars)
- macOS `say` kostenlos, deutsche Stimmen vorhanden

---

## Pipeline

```
[User hält ⌘+Space]
        │
        ▼
   Mic Recording (16kHz mono)
        │
        ▼
   Whisper API → Text
        │
        ▼
   Backend (Claude Code oder OpenClaw)
        │
        ▼
   Antwort als Text
        │
        ▼
   TTS → Audio
        │
        ▼
   Lautsprecher + Mini-Notification
```

---

## App-Architektur

```
voice-overlay/
├── src-tauri/              # Rust Backend
│   ├── main.rs             # Window setup, hotkey, system tray
│   ├── audio.rs            # Mic recording (cpal)
│   ├── whisper.rs          # OpenAI Whisper API call
│   ├── backend.rs          # Claude Code CLI / OpenClaw WS
│   └── tts.rs              # OpenAI TTS API call
├── src/                    # Frontend (Vue/Svelte/React)
│   ├── App.tsx             # Mini overlay window
│   ├── components/
│   │   ├── MicButton.tsx   # Push-to-talk indicator
│   │   ├── Status.tsx      # "Listening...", "Thinking...", "Speaking..."
│   │   └── History.tsx     # Letzte Befehle
│   └── settings.tsx        # Backend toggle, hotkey config
└── package.json
```

---

## States / UI

**Idle:** Kleines graues Icon
**Listening:** Rotes pulsierendes Mic
**Thinking:** Blauer Spinner
**Speaking:** Grüner Wave
**Error:** Rotes X mit Tooltip

---

## Befehl-Beispiele & Routing

| Befehl | Backend | Tool |
|---|---|---|
| "Schreib Fabian auf Telegram..." | OpenClaw (Silver Surfer) | Telegram tool |
| "Check meine Mails" | OpenClaw (Sietch) | Gmail tool |
| "Erstell einen Commit" | Claude Code lokal | Bash |
| "Welche Cron Jobs laufen?" | Claude Code lokal | SSH |
| "Status meiner Bots?" | Claude Code lokal | curl Supabase |

---

## Permissions (macOS)

- **Microphone access** — für Recording
- **Accessibility** — für globale Hotkey
- **Notifications** — optional für Status

---

## Kosten-Schätzung (Daily Use)

- **Whisper:** 50 Befehle/Tag × 5s = ~4min/Tag = $0.024/Tag = ~$0.70/Monat
- **Claude:** je nach Modell, mit Haiku ~$0.50/Monat
- **TTS:** 50 × 100 chars = 5k chars/Tag = $0.075/Tag = ~$2.25/Monat

**Total:** ~$3.50/Monat für täglichen Use

---

## Implementation Order

1. **Tauri Setup** — Menu bar icon, global hotkey
2. **Mic recording** — Push-to-talk via cpal
3. **Whisper integration** — Audio → Text
4. **Backend wiring** — Claude Code CLI call
5. **TTS** — Text → Audio playback
6. **OpenClaw backend** — WebSocket alternative
7. **Settings UI** — Backend toggle, hotkey config
8. **History/Logs** — Letzte 20 Befehle
9. **Polish** — Animations, error handling

---

## Open Questions (für später)

- Soll die App auch Wake Word ("Hey Staima") unterstützen oder nur Push-to-talk?
- Sprache: Deutsch only oder mehrsprachig?
- Speichert die App Audio lokal oder direkt löschen nach Whisper?
- Kontext über mehrere Befehle (Conversation Memory)?
- Multi-Bot Routing automatisch oder manuell auswählen?
