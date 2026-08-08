# ARGUS Relay 1.6.4 — Clean-First Atlas Bridge

- Atlas now receives the DeepSeek-cleaned headline/body for link articles, matching the clean ARGUS test output.
- Raw browser labels/image filenames are no longer forwarded to Atlas before cleaning.
- Routine weather is no longer promoted to Breaking merely because Android marks it `urgent_weather`.
- Red/emergency/tsunami/cyclone weather may still be promoted; orange maps to high priority.
- Incomplete weather fallbacks such as `Maldives Weather / Forecaster: Photo message` with no image or URL are skipped for Atlas rather than publishing noise.
- Atlas forwarding remains durable/retryable and independent failures do not poison ARGUS test-group delivery.
