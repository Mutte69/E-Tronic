# ARGUS Relay 1.6.10 — USGS Structured Payload Hotfix

## Production finding

The live Relay 1.6.9 dry-run for `world-usgs-significant-earthquakes` correctly switched to `mode=usgs_geojson`, but a candidate that reached structured payload construction failed with:

```text
earthquake is not defined
```

## Root cause

`server-collector.js` correctly stores the structured USGS object in local variable `quake`, but the payload metadata used an undefined shorthand property named `earthquake`.

## Fix

The payload now explicitly maps:

```js
earthquake: quake
```

This preserves all structured fields including magnitude, depth, PAGER alert, MMI, felt reports, tsunami flag, USGS significance, coordinates, event id and timestamps.

## Regression coverage

The World collector integration suite now includes both:

- remote M5.6/no material impact -> deterministic reject before AI
- M7.2 passing event -> dry-run preview payload is constructed successfully with `eventType=earthquake_event` and structured metadata

This prevents a test suite that only exercises the rejection path from missing payload-construction failures.

## Scope

No changes to Android, Telegram/Viber ingestion, Maldives sources, MMS Weather Suite, CAP, Atlas bridge, Samuga forwarding, World source count, World thresholds, or automatic collector enablement. World collectors remain off by default.
