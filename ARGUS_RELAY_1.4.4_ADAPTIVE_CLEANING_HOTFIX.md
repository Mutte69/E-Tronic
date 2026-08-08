# ARGUS Relay 1.4.4 — Adaptive Cleaning Hotfix

## Fix

- Keeps DeepSeek cleaning before Telegram test delivery.
- Retries DeepSeek once when the first selected article body is suspiciously short or invalid.
- Accepts legitimate short notices only when the original capture itself is short and the cleaned result still contains meaningful text.
- Rejects truncated output from long source articles instead of forwarding incomplete content.
- Adds `CLEANING_RETRY` logs and metadata for `cleaningAttempts`, `cleanBodyMeaningfulLength`, and cleaning status.

## Cleaning statuses

- `cleaned`: normal valid result on first attempt.
- `cleaned_retry`: recovered valid result on the second attempt.
- `cleaned_short_valid`: legitimate short notice accepted.

Android code is unchanged.
