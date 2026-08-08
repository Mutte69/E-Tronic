# ARGUS Relay 1.6.3 — Atlas Wire Bridge

## Goal

Connect ARGUS to Atlas Wire without coupling Atlas publication to DeepSeek cleaning, event intelligence, Samuga News Bot, or the ARGUS test Telegram group.

## Pipeline

ARGUS receive
→ normalize raw capture
→ persist Atlas forward record
→ async Atlas Wire ingest
→ continue existing DeepSeek/test-group/Samuga path independently

## Reliability

- Atlas forwarding is optional and fail-open for the rest of ARGUS.
- Pending forwards survive relay restarts in `argus-events.json`.
- Retries use 15s → 60s → 5m → 15m → 1h and then hourly.
- Atlas 2xx/duplicate responses are treated as successful delivery.
- Atlas ingest idempotency remains the public duplicate guard.
- Samuga `supporting_coverage` suppression does not suppress Atlas Wire.

## Variables

- `ATLAS_WIRE_INGEST_URL`
- `ATLAS_WIRE_INGEST_SECRET`
- optional `ATLAS_RETRY_INTERVAL_MS`
- optional `ATLAS_RETRY_BATCH`

No existing variables are renamed.
