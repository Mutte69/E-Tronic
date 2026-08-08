# ARGUS Relay 1.6.6 — MMS Weather Suite

Build date: 2026-08-09
Baseline: ARGUS Relay 1.6.5 MET CAP Alerts (itself based on the deployed 1.6.4 Clean-First Atlas Bridge)

## Purpose

Expand Maldives Meteorological Service collection beyond emergency CAP alerts so ARGUS can provide routine official weather products needed by downstreams such as Samuga News Bot and Atlas Wire without depending on Android screenshots, OCR, or AI extraction.

## New deterministic MMS sources

### `mv-met-routine-forecast`

Official page: `https://meteorology.gov.mv/forecast`

Collector mode: `met_forecast`

Extracts when present:

- General Forecast
- General weather text
- Winds
- Seas
- Wave Height
- Advisory
- Marine Forecast
- Marine weather text
- Marine winds
- Marine seas
- Marine wave height
- Valid-from / valid-to window
- Tomorrow station outlook
- Next 48 hours station outlook
- Next 72 hours station outlook
- Hulhule, Hanimaadhoo, Kadhdhoo, Kaadehdhoo and Gan outlook cards
- Day/night edition hint based on the official validity start time

The page is a fixed URL, so ARGUS uses a deterministic content fingerprint as the seen key and capture identity. A changed official forecast is therefore a new capture; an unchanged forecast is deduplicated.

Payload:

- `eventType=weather_update`
- `contentType=weather_forecast`
- `category=weather`
- `metadata.deterministicStructured=true`
- `metadata.weatherProduct=mms_routine_forecast`

### `mv-met-tide-predictions`

Official page: `https://meteorology.gov.mv/?pd=home`

Collector mode: `met_tide`

Targets MMS tide-prediction data for:

- Hulhule — central Maldives
- Hanimaadhoo — northern Maldives
- Gan — southern Maldives

Extraction supports visible HTML time/height values and deterministic embedded JSON/script chart structures. If the tide chart is detected but numeric time/height points cannot be extracted, ARGUS returns `skipped_tide_unusable`, does not submit a capture, and does not permanently mark the shell seen.

Payload when usable:

- `eventType=tide_update`
- `contentType=tide_forecast`
- `category=weather`
- `metadata.deterministicStructured=true`
- `metadata.weatherProduct=mms_tide_prediction`
- structured tide date/stations/points

## Existing CAP alerts preserved

`mv-met-cap-alerts` remains unchanged as the authoritative alert/update/cancel path. Routine forecast/tide products do not replace CAP warnings.

## Clean-first / AI behavior

Routine MMS weather and tide payloads set `metadata.deterministicStructured=true`. Relay therefore does not send the authoritative structured weather text through DeepSeek cleaning. Downstream Atlas/Samuga forwarding remains independent and unchanged.

## Safety defaults

- `ARGUS_SERVER_COLLECTORS_ENABLED=false` remains the deployment requirement.
- `mv-met-cap-alerts.collectorConfig.autoCollect=false`
- `mv-met-routine-forecast.collectorConfig.autoCollect=false`
- `mv-met-tide-predictions.collectorConfig.autoCollect=false`
- Legacy MMS `/news` collector remains `autoCollect=false`.
- No Android code was changed.
- No screenshot/OCR dependency was introduced.
- Live tide numeric extraction is not claimed until a Railway dry-run proves the current MMS chart representation.
- Live routine-forecast freshness is not claimed until a Railway dry-run proves the current production page response.

## Source pack

The Maldives core source pack now contains 40 source records.

All MMS products share `entityId=mv-met` so future event correlation can understand that CAP alerts, routine forecasts, tide predictions and legacy web news belong to the same official authority.

## Validation

Local validation added coverage for:

- General + Marine forecast extraction
- Wave height
- Advisory
- Validity windows
- Day/night edition inference
- 15 station outlook records across Tomorrow / 48 hr / 72 hr
- Tide JSON time/height extraction for three MMS tide regions
- Tide unusable-shell protection
- Deterministic structured payloads
- Fixed-URL content fingerprinting
- Same forecast dedupe
- Changed forecast re-capture
- Existing CAP behavior
- Existing Atlas bridge
- Existing web collector hardening
- Existing source registry and source pack
