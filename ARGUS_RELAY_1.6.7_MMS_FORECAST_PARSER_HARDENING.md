# ARGUS Relay 1.6.7 — MMS Forecast Parser Hardening

## Why this build exists

The first real Railway dry-run of `mv-met-routine-forecast` on Relay 1.6.6 proved that the live MMS page could be fetched and that the Marine Forecast and wave height were extracted, but it also exposed two production-only parser gaps:

- `generalForecast` was empty even though the page carries a General Forecast.
- `stationOutlookCount` was `0` even though MMS exposes Tomorrow / Next 48 hrs / Next 72 hrs station cards.

The live page can expose early `General Forecast` / `Marine Forecast` labels used as tabs/navigation before the actual content sections. Relay 1.6.6 chose the first literal heading occurrence. Station card markup can also collapse temperature and condition into the same visible text line.

## Changes

- Forecast parsing now evaluates all General Forecast and Marine Forecast heading occurrences and chooses the most contentful deterministic block.
- Empty tab/navigation copies no longer hide the actual forecast content later in the page.
- Station outlook parsing is anchored to explicit `Tomorrow`, `Next 48 hrs`, and `Next 72 hrs` groups when present.
- Station temperature parsing now accepts separate or collapsed values such as `30°C` and `30°C Thundershowers`.
- A backward-compatible station occurrence fallback remains for older MMS markup.
- Existing CAP alert, tide, Android ingest, Atlas bridge, Samuga forwarding, DeepSeek cleaning, event intelligence, source registry and web/RSS behavior are unchanged.
- Automatic server collectors remain disabled by default.

## Production acceptance target

Re-run only:

`mv-met-routine-forecast?dryRun=true`

Expected result before proceeding:

- `discovered=1`
- `weather.generalWaveHeight` populated when MMS supplies it
- `payload.metadata.generalForecast.weather` populated
- `payload.metadata.generalForecast.winds` populated
- `payload.metadata.generalForecast.seas` populated
- `payload.metadata.stationOutlook` populated when MMS exposes station outlook cards
- Marine forecast / wave height remains intact

Do not enable automatic server collectors until this Railway dry-run passes.
