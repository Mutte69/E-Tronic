# ARGUS Relay 1.4.3 — Delivery Observability Hotfix

## Fixed
- DeepSeek cleaning explicitly disables thinking mode to keep the Android request within its 30-second read timeout.
- Every delivery stage now logs with the capture ID.
- Telegram test delivery always contains the DeepSeek-cleaned article.
- Event duplicate decisions remain enabled after test-group delivery.
- Samuga forwarding failures are persisted as `pending_delivery` and retried automatically.
- Added authenticated `POST /api/argus/retry-samuga` for manual retries.
- `/health` now exposes runtime counters and the last processing stage without exposing secrets.

## Required Railway variables
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `ARGUS_RELAY_SECRET`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL=deepseek-v4-flash` (or `deepseek-v4-pro`)
- `SAMUGA_INGEST_URL`
- `SAMUGA_INGEST_SECRET`

No Android app change is required.
