# ARGUS Relay 1.6.8 — World Signal Foundation

## Goal

Add high-signal world-news collection for both Atlas Wire and Samuga News Bot without turning ARGUS into a high-volume headline dump or spending AI calls on low-value items.

## Baseline

Built directly from ARGUS Relay 1.6.7 MMS Forecast Parser Hardening. Existing Android ingest, DeepSeek cleaning, Telegram test delivery, event intelligence, Samuga forwarding, Atlas clean-first bridge, Source Registry, Web/RSS collectors and MMS Weather Suite are preserved.

## New world pack

Bundled `source-packs/world-core-v1.json` adds 9 sources:

1. BBC News — World RSS
2. BBC News — Business RSS
3. BBC News — Technology RSS
4. Al Jazeera English RSS
5. United Nations News RSS
6. GDACS — Global Disaster Alerts RSS
7. USGS — Significant Earthquakes Atom
8. WHO — Disease Outbreak News
9. ICAO Newsroom

All world sources:

- use `region: WORLD`
- include the `world-signal` tag
- use `collectorConfig.worldSignalEnabled=true`
- ship with `collectorConfig.autoCollect=false`

The Maldives pack remains separate and unchanged at 40 sources. Importing both packs produces 49 registered sources, 9 of them WORLD, with 0 world sources enabled for automatic polling.

## Multiple startup source packs

Relay now supports a second bundled source pack without replacing the existing Maldives pack.

Existing variables remain valid:

```text
ARGUS_SOURCE_PACK_AUTO_IMPORT=true
ARGUS_SOURCE_PACK_PATH=source-packs/maldives-core-v1.json
```

New optional variables:

```text
ARGUS_WORLD_SOURCE_PACK_AUTO_IMPORT=true
ARGUS_WORLD_SOURCE_PACK_PATH=source-packs/world-core-v1.json
```

If `ARGUS_WORLD_SOURCE_PACK_AUTO_IMPORT` is not explicitly set, it follows `ARGUS_SOURCE_PACK_AUTO_IMPORT`.

## World Impact Gate

New module: `world-signal.js`.

World sources are filtered before `/api/argus/package`, therefore filtered/watch items never reach DeepSeek cleaning, Atlas forwarding or Samuga forwarding.

Flow:

```text
world RSS/web source
  ↓
cheap title/description score
  ├ below candidate floor → WORLD FILTERED (no article fetch, no AI)
  ↓
deterministic article extraction
  ↓
World Impact Gate
  ├ PASS  → existing ARGUS ingest → DeepSeek → Atlas + Samuga
  ├ WATCH → persistent correlation observation, no AI
  └ REJECT → mark seen/filter, no AI
```

Default thresholds:

```text
candidate floor = 25
watch           = 50
publish         = 70
```

Thresholds are configurable per source:

```text
worldSignalEnabled
worldSignalCandidateFloor
worldSignalWatchScore
worldSignalPublishScore
worldSignalCorroborationHours
```

## High-signal scoring

Positive signals include:

- war/escalation/ceasefire/invasion/missile/airstrike
- coups, state emergencies and government collapse
- major earthquakes, cyclones, tsunami, floods, eruptions and evacuations
- election/power changes
- shipping, Hormuz, Red Sea, Suez, oil and energy disruptions
- airspace/airport closures, major aviation accidents and systemic flight disruption
- internationally significant outbreaks/public-health events
- systemic financial shocks/defaults/market crashes
- critical cyber/infrastructure outages
- major AI/semiconductor/technology events
- sanctions, treaties and peace agreements
- mass casualties and multi-country disruption

Additional Maldives-relevance boosts are applied to:

- India
- Sri Lanka
- Indian Ocean / Arabian Sea / Bay of Bengal
- Gulf states
- Iran / Yemen
- Hormuz / Red Sea / Suez / Bab el-Mandeb
- South Asia
- China

## Noise suppression

Strong negative scoring suppresses:

- sports
- celebrity/entertainment
- opinion/analysis/explainers/features
- routine meetings, workshops and MoUs
- ordinary local crime
- lifestyle/travel-deal content

## Corroboration model

Global media sources are tagged `corroboration-required`.

Even a very high-scoring BBC/Al Jazeera item remains WATCH until a different source produces a sufficiently similar event signal.

WATCH observations are stored in the existing persistent collector state (`worldSignals`) with headline tokens, timestamp, source and score. A later item from a different source is compared using deterministic token similarity inside the configured correlation window. A valid second source adds a corroboration boost and can promote the new item to PASS.

High-signal authoritative sources can pass directly when their source-specific profile matches:

- GDACS disaster signal
- USGS significant earthquake signal
- WHO outbreak signal

UN/ICAO are authoritative but still require enough substantive impact score; routine institutional material should remain WATCH/REJECT.

## Downstream metadata

Accepted world captures are marked before submission with:

```text
region = WORLD
metadata.storyRegion = world
metadata.worldSignal.score
metadata.worldSignal.decision = pass
metadata.worldSignal.reason
metadata.worldSignal.correlationKey
metadata.worldSignal.correlatedSources
metadata.worldSignal.reasons
```

This flows through the existing ARGUS payload to both Atlas Wire and Samuga News Bot. Source-type categories are retained where useful (business, technology, health, emergency, aviation); general international captures use `world`.

## Observability

New log events:

```text
[WORLD_SIGNAL_PASS]
[WORLD_SIGNAL_WATCH]
```

Dry-run results expose:

```text
world_filtered_pre_ai
world_watch_pre_ai
preview
```

with score, reason and signal breakdown so thresholds can be tuned safely before any world collector is enabled.

## Safety / deployment rule

`ARGUS_SERVER_COLLECTORS_ENABLED=false` must remain in production during initial verification.

No world source is production-proven by this local build alone. Deploy first, inspect startup, then dry-run one source at a time. Suggested order:

1. `world-usgs-significant-earthquakes`
2. `world-gdacs-rss`
3. `world-bbc-world-rss`
4. `world-aljazeera-all-rss`
5. `world-who-disease-outbreak-news`
6. remaining sources

Do not enable all world collectors until live Railway dry-runs confirm feed accessibility, parsing quality and acceptable World Impact Gate decisions.

## Android

No Android files were changed.
