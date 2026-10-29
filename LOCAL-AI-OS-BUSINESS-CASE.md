# Local AI OS — Business Case
## Souveräner, selbst-gehosteter KI-Coding-Agent für deutschen B2B-Markt

> **Stand:** Juni 2026 · Recherche mit Live-Quellen (Artificial Analysis, Hugging Face, vLLM, GPU-Preise 2026)
> **Kernthese:** Kein eigenes Modell bauen. Ein **DSGVO-konformer, on-prem KI-Agent** auf Basis offener Gewichte (GLM 5.2, MIT) + offenem Harness (OpenCode, MIT), verkauft als **Lizenz + Support** an regulierte deutsche Firmen.

---

## 1. Das Urteil in einem Satz

Tragfähig — **aber nur als on-prem Lizenz-Modell (Kunde hostet), nicht als billiger Cloud-Claude.** Der Verkaufshebel ist **Datensouveränität (DSGVO / EU AI Act / CLOUD Act)**, nicht der Preis. Der Moat ist **Integration + Compliance + deutscher Support + 1-Klick-Deployment**, nicht das Modell.

---

## 2. Was technisch geht (und was nicht)

### GLM 5.2 — die Modell-Basis
| Punkt | Fakt | Bedeutung |
|---|---|---|
| **Lizenz** | Gewichte **MIT**, Code **Apache-2.0**, Copyright Zhipu 2026 | ✅ Kommerzieller Resale (SaaS + on-prem) **uneingeschränkt** erlaubt — keine Revenue-Caps, kein No-Compete, keine China-Klausel |
| **Größe** | 744B MoE, ~40B aktiv, 1M Kontext, text-only | Cleverer Inference-Aufwand (nur 40B aktiv), aber riesige Gewichte |
| **Hardware** | ~750 GB VRAM @ FP8 → **8× H200** | 🔴 Kein Single-GPU-Weg. ~200k € gekauft / 22–36k €/Mt Cloud |
| **China-Datenrisiko** | Gilt **nur** für Z.ai-Cloud-API | Selbst gehostet = irrelevant → sogar Verkaufsargument |

### Qualität vs. Claude Opus 4.8 — ehrlich
- **Einzelne Coding-Tasks:** FrontierSWE **74,4 vs 75,1** → praktisch gleich. „Fast so gut" stimmt **hier**.
- **Lange autonome Agent-Läufe** (der eigentliche Use-Case): SWE-Marathon **13 vs 26** → Opus 2× besser. NL2Repo 49 vs 70.
- **Intelligence-Index gesamt:** 51 vs 61,4 → eine Tier-Stufe dahinter.
- **Warnung:** GLM zeigt „reward hacking" (Tasks umgehen statt lösen) → Risiko bei unbeaufsichtigtem Betrieb.
- **Fazit:** „Gut genug" für viele Firmen-Use-Cases, **nicht** Frontier. Auf der eigenen Arbeitslast testen, bevor man committet.

### Harness (das „Claude-Code"-Gerüst)
- **Primär: OpenCode (sst/opencode) — MIT.** Reifster offener Agent-Harness (Tool-Loop, Multi-File-Edits, Terminal, MCP, LSP). Modell-agnostisch → zeigt per OpenAI-kompatibler API direkt auf lokales vLLM/Ollama. ~170k Stars. Sauberster IP-Status für B2B.
- **Hedge: Goose (Block) — Apache-2.0.** Unter Linux-Foundation-Governance → wird nicht aufgekauft/eingestellt (wie es Continue passierte).
- **🚫 Geleakten Claude Code MEIDEN.** Der npm-Leak vom 31.03.2026 (~512k Zeilen) ist rechtlich ungeklärt: Copyright **+ Trade-Secret** (überlebt auch „clean-room"-Rewrite) **+ ToS-Bruch beim Input**. Für ein Produkt, das deutsche Enterprises mit IP-Due-Diligence kaufen → inakzeptabel.

---

## 3. Markt — die Chance

### Warum jetzt
- **EU AI Act** greift ab **2. August 2026** (Strafen bis 35 Mio € / 7% Umsatz).
- **CLOUD Act:** US-Behörden können US-Anbieter zur Datenherausgabe zwingen — egal wo gespeichert, ohne EU-Gericht.
- **Präzedenz:** Italiens Garante verhängte 15 Mio € GDPR-Strafe gegen OpenAI.
- **Konkrete Lücke:** Anthropic ist **außerhalb der Microsoft EU-Data-Boundary** — Copilot-Anfragen an Claude verlassen die EU.
- **GenAI-Adoption DE:** 26% (2024) → 44% (2025) → **56% (2026)** → wachsende Käuferbasis, die an die Souveränitäts-Wand stößt.
- Käufer zahlen für EU-Souveränität bereits **bis zu 40% Aufpreis** (IONOS/OVH vs US-Hyperscaler).

### „Keine KI-Firma in Deutschland" — fast richtig
- **Aleph Alpha existiert** (Pharia/PhariaAI, on-prem, SAP/Bosch). Also faktisch falsch.
- **ABER:** April 2026 von **Cohere (Kanada)** übernommen, ~20 Mrd. $. Kommentatoren: „der stille Verkauf von Deutschlands KI-Hoffnung." → **Vertrauens-Gap** bei deutschen Käufern, die einen *unabhängigen* Anbieter wollen.

### Wettbewerb
| Anbieter | Herkunft | Lücke für dich |
|---|---|---|
| Mistral (Le Chat/Vibe, Code Mode) | 🇫🇷 Frankreich | Stärkster EU-Coding-Konkurrent, aber nicht deutsch |
| Aleph Alpha / Cohere | 🇩🇪→🇨🇦 | Modell-Ebene, jetzt ausländisch |
| Tabnine (on-prem, 39–59 $/Seat) | 🇺🇸/🇮🇱 | Direkt, aber ausländisch |
| OpenCode / Continue / Refact (OSS) | — | DIY — braucht eigene ML-Ops beim Kunden |

➡️ **Unterversorgt:** ein **deutsch-domiziliertes, fertig paketiertes, vollständig selbst-gehostetes Agenten-Produkt** für Mittelstand, der kein vLLM-Cluster betreiben kann/will. Verkauft + supportet auf Deutsch.

**Käufer:** CISO / Datenschutzbeauftragter / Compliance-Lead — **nicht** der einzelne Entwickler. Verkauf ist compliance-getrieben → geringere Preissensibilität.

---

## 4. ROI — zwei Modelle

### Modell A — Du hostest (SaaS, EU-Server)
| Gefüllte Seats / Box | COGS/Seat | Marge @ 50 € |
|---|---|---|
| 50 | ~70 € | **negativ** |
| 200 | ~17 € | ~66% |
| 1.000 | ~3,5 € | ~93% |

🔴 **Break-even erst bei ~120–150 zahlenden Seats.** Du finanzierst GPUs (200k € oder 22–36k €/Mt), **bevor** Kunden da sind. Für Solo/klein = ungeeignet.

### Modell B — Kunde hostet (on-prem Lizenz) ✅ **EMPFOHLEN**
COGS ≈ **0** (Kunde zahlt eigene GPU). Du verkaufst Lizenz + Support + Updates. Marge **80–95%**.

| Firmen-Lizenzen | Ø Seats | Umsatz/Mt (@30 €/Seat) | Gewinn/Mt |
|---|---|---|---|
| 5 | 10 | 1.500 € | **~1.200 €** |
| 20 | 15 | 9.000 € | **~7.000 €** |
| 50 | 20 | 30.000 € | **~24.000 €** |

**Alternativ perpetual:** 30–80k € Lizenz/Firma + 18–22% Wartung/Jahr. (5 Deals = 250k € upfront + 55k €/Jahr wiederkehrend.)

**Preis-Anker:** Claude Enterprise ~130 €/Seat. Du **unterbietest um 60–75%** UND bietest „Daten verlassen nie das Haus."

### Weitere Kosten (realistisch)
- **ISO 27001:** 15–35k € initial — faktisch Pflicht für deutschen B2B + NIS2. **Erst nach 2–3 Pilotkunden angehen.**
- Support skaliert mit Deal-Zahl (~0,5 FTE ab 20 Kunden).
- Modell-Update-Zyklus: ~12k € Re-Validierung pro neuem GLM-Release.
- SOC 2 vorerst überspringen (nur für US-Kunden relevant).

---

## 5. Risiken

1. **Qualitäts-Gap** (höchstes Risiko) — wenn das Modell sichtbar schwächer ist als Claude, schließt der 130→30-€-Rabatt keine Deals. → Auf realer Kundenarbeitslast testen.
2. **Commoditisierung** — MIT-Gewichte kann jeder nehmen. Moat = Integration/Support/Compliance, **nicht** das Modell. Margen werden langfristig gedrückt.
3. **Support-Last (Modell B)** — jede Kundenumgebung anders; GPU/Treiber/Netz-Debugging frisst die 90%-Marge. → **Productize:** 1-Command-Docker/vLLM-Deploy, Self-Healing, Monitoring, standardisierte Hardware-Liste. (Nutzt deine Claudia/MyTy-Watchdog-Erfahrung.)
4. **GPU-Preisvolatilität** — gut für COGS, aber Konkurrenz-Kosten sinken auch; gekaufte Hardware-Capex riskiert „stranding".

---

## 6. Empfehlung & nächste Schritte

**Bauen: souveräner on-prem KI-Agent (Modell B), kein eigenes Modell, kein Cloud-Hosting.**

Positionierung: **„DSGVO-konforme on-prem KI-Agent-Plattform — Ihre Daten verlassen nie Ihr Haus."** Nicht „billiger Claude-Klon."

Reihenfolge (capital-light):
1. **MVP** = OpenCode (rebranded) + GLM 5.2 via vLLM, als 1-Command-Docker-Paket. Modell-agnostisch lassen (auch Mistral/Aleph-Alpha als Backend möglich → flexibler Pitch).
2. **2–3 deutsche Pilotkunden** aus regulierten Branchen finden, die das WOLLEN — **bevor** Hardware/ISO-Investment. Pilot validiert Qualität + Zahlungsbereitschaft.
3. Erst dann: ISO 27001, Self-Healing-Härtung, Sales-Skalierung.

### Pilot-Pitch (1 Absatz)
> „Ihre Entwickler bekommen einen KI-Coding-Agenten auf Claude-Niveau — aber er läuft komplett auf Ihrer Hardware. Kein Byte Code verlässt Ihr Haus, voll DSGVO- und EU-AI-Act-konform, kein US-CLOUD-Act-Risiko. Wir installieren, härten und supporten ihn auf Deutsch. 60–75% günstiger als US-Cloud-KI, plus Datensouveränität, die Sie bei OpenAI/Anthropic nicht bekommen."

---

## Quellen (Auswahl)
- GLM 5.2 Lizenz (MIT): https://huggingface.co/zai-org/GLM-5.2/blob/main/LICENSE · Code (Apache): https://github.com/zai-org/GLM-5/blob/main/LICENSE
- Benchmarks: https://artificialanalysis.ai/models/glm-5-2 · https://artificialanalysis.ai/articles/claude-opus-4-8-analysis-and-benchmarks · https://www.digitalapplied.com/blog/glm-5-2-benchmarks-open-weights-vs-claude-opus
- Hardware/Inference: https://recipes.vllm.ai/zai-org/GLM-5.2 · https://ofox.ai/blog/glm-5-2-self-host-vllm-hardware-cost-2026/
- Harness: https://github.com/sst/opencode · https://block.xyz/inside/block-open-source-introduces-codename-goose · Claude-Code-Leak-Recht: https://www.beankinney.com/512000-lines-one-night-zero-permission-the-claude-code-leak-and-the-legal-crisis-of-ai-clean-rooms/
- Markt/Regulierung: https://cepr.org/voxeu/columns/generative-ai-german-firms-diffusion-costs-and-expected-economic-effects · https://www.heuking.de/en/news-events/newsletter-articles/detail/anthropic-claude-in-the-enterprise-data-protection-and-compliance-requirements-for-the-use-of-generative-ai.html · Cohere/Aleph Alpha: https://www.cnbc.com/2026/04/24/cohere-aleph-alpha-germany-ai-europe-expansion.html
- GPU-Preise/ROI: https://www.spheron.network/blog/gpu-cloud-pricing-comparison-2026/ · https://www.hetzner.com/dedicated-rootserver/matrix-gpu/ · ISO 27001: https://elevateconsult.com/insights/iso-27001-certification-cost-2026-expert-verified-budget-guide/
