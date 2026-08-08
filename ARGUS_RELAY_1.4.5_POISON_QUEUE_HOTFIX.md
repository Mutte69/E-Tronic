# ARGUS Relay 1.4.5 — Poison Queue Hotfix

- Accepts legitimate ultra-short source notices when DeepSeek preserves at least 70% of the meaningful source text.
- Quarantines irrecoverably short/incomplete captures after two DeepSeek attempts.
- Sends a Telegram quarantine notice for visibility.
- Returns HTTP 200 for quarantined captures so one bad capture cannot block every newer Android queue item.
- Quarantined captures are never forwarded to Samuga and never enter event intelligence.
- Android app changes are not required.
