# ARGUS Relay 1.4.6 — Poison Queue Hardening

- Treats DeepSeek selections with no valid headline or no body lines as non-retryable unusable captures.
- Quarantines those captures and returns HTTP 200 so the Android queue can advance.
- Even if the Telegram quarantine notice itself fails, the relay still acknowledges and clears the poison capture.
- No Android changes required.
