# ARGUS Relay 1.6.9 — World Signal Quality Hardening

## Why this patch exists

The first real Railway dry-run of `world-usgs-significant-earthquakes` returned a remote M5.6 Alaska event with `score=80`, `decision=pass`. The pipeline mechanics were correct, but the editorial signal gate was too permissive. The same test also showed that materializing the USGS browser event page produced browser-support boilerplate instead of useful earthquake facts.

This patch keeps the 1.6.8 World Signal architecture but hardens the USGS path before any automatic world collection is enabled.

## Changes

- Switch USGS discovery from Atom + event-page scraping to the official USGS Significant Earthquakes GeoJSON feed.
- Add deterministic `usgs_geojson` parsing.
- Preserve structured fields:
  - magnitude
  - place
  - event/update time
  - latitude / longitude
  - depth
  - PAGER alert
  - MMI / CDI
  - felt reports
  - tsunami flag
  - USGS significance
  - event status/type
- Build a deterministic earthquake body from those fields; never use the event-page browser fallback for this source.
- Lower the source-only base score for earthquake feeds. Authority proves reliability, not importance.
- Add earthquake-specific impact scoring.
- Direct authoritative PASS now requires a material earthquake signal such as:
  - magnitude 7.0+
  - PAGER yellow/orange/red
  - USGS tsunami flag
- Remote lower-impact events can be rejected or held at WATCH without any AI call.
- Raise USGS candidate floor to 45 so obvious low-impact events die at the cheapest stage.
- Preserve existing Maldives, MMS Weather, Android ingest, Atlas bridge, Samuga forwarding, world correlation and world media filtering behavior.
- Automatic world collection remains OFF.

## Acceptance rule

The production example `M 5.6 - 57 km WNW of Skwentna, Alaska` with no material PAGER/tsunami/impact signal must no longer PASS simply because it is present in the USGS significant feed.

## Deployment safety

Keep:

`ARGUS_SERVER_COLLECTORS_ENABLED=false`

Then re-run only the USGS dry-run and inspect the structured earthquake fields and World Signal decision before testing the next world source.
