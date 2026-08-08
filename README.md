# ARGUS Relay 1.6.10 — USGS Structured Payload Hotfix

ARGUS Relay receives Android Telegram/Viber captures and contains the server-side Web/RSS collector foundation, deterministic MMS Weather Suite, and clean-first Atlas Wire bridge. Version 1.6.10 preserves the verified 1.6.7 Maldives/MMS behavior and adds a separate World Signal layer that filters global sources before any AI call. Broad world feeds are allowed to detect events, but only high-impact or corroborated signals are submitted into the existing ARGUS pipeline. All new world collectors ship with automatic collection disabled.

## Current production paths

### Android

```text
Telegram / Viber notification
→ ARGUS Android node
→ POST /api/argus/package
→ DeepSeek extraction-only cleaning
→ Telegram test group
→ event intelligence
→ Samuga News Bot
```

### Server collectors

```text
Central Source Registry
→ Web/RSS/CAP/MMS weather collector
→ deterministic extraction / structured weather parsing
→ POST /api/argus/package
→ same existing ARGUS pipeline
```

The second path is disabled by default until explicitly enabled.


## Maldives Meteorological Service weather sources

The Maldives core source pack contains three dedicated MMS products sharing `entityId: mv-met`:

- `mv-met-cap-alerts` — official CAP alerts.
- `mv-met-routine-forecast` — General Forecast, Marine Forecast, wave height, advisories and Tomorrow/48-hour/72-hour station outlooks from `/forecast`.
- `mv-met-tide-predictions` — tide chart data for Hulhule, Hanimaadhoo and Gan from the MMS home page.

Routine forecast updates use a content fingerprint rather than the fixed page URL, so a changed day/night edition becomes a new capture while an unchanged edition is deduplicated. Tide data is submitted only when numeric time/height points can be extracted; a chart shell without usable values remains retryable.

Safety defaults:

- `collectorConfig.autoCollect=false` for CAP, routine forecast and tide sources until real Railway dry-runs verify each live product.
- The legacy MMS website source also has `autoCollect=false`.
- `ARGUS_SERVER_COLLECTORS_ENABLED=false` remains the required global production setting until verification is complete.
- CAP `Test`, `Exercise`, `System`, `Draft`, private/restricted and Ack/Error messages are not submitted as public alerts.
- CAP `Alert`, `Update` and `Cancel` references are preserved for downstream correlation.

## Required Railway variables

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `ARGUS_RELAY_SECRET`
- `DEEPSEEK_API_KEY`

## Persistent Railway volume

Mount a Railway volume at `/data` and use:

```text
EVENT_STORE_PATH=/data/argus-events.json
CAPTURE_ARCHIVE_PATH=/data/argus-captures.jsonl
ARGUS_SOURCE_STORE_PATH=/data/argus-sources.json
ARGUS_COLLECTOR_STATE_PATH=/data/argus-collector-state.json
```

## Source Registry

Admin endpoints require `x-argus-secret`:

```text
GET    /api/argus/sources
GET    /api/argus/sources/stats
GET    /api/argus/sources/:id
POST   /api/argus/sources
POST   /api/argus/sources/import
PATCH  /api/argus/sources/:id
DELETE /api/argus/sources/:id
```

JSON and CSV bulk import are supported. `?dryRun=true` validates without writing.

Source entries can now include `collectorConfig`:

```json
{
  "mode": "web",
  "autoCollect": true,
  "bootstrapMode": "mark_seen",
  "discoveryUrl": "https://example.mv/news",
  "feedUrl": "",
  "includeUrlPatterns": [],
  "excludeUrlPatterns": [],
  "pollIntervalSeconds": 300,
  "maxItemsPerPoll": 5,
  "maxAgeHours": 72,
  "minCandidateScore": 3,
  "minArticleBodyLength": 120,
  "minArticleWords": 15,
  "worldSignalEnabled": false,
  "worldSignalCandidateFloor": 25,
  "worldSignalWatchScore": 50,
  "worldSignalPublishScore": 70,
  "worldSignalCorroborationHours": 12,
  "allowExternalLinks": false
}
```

## Bundled Maldives pack

`source-packs/maldives-core-v1.json` contains 40 Maldives sources, including dedicated CAP, routine forecast and tide products for MMS.

To idempotently import/update it during startup:

```text
ARGUS_SOURCE_PACK_AUTO_IMPORT=true
ARGUS_SOURCE_PACK_PATH=source-packs/maldives-core-v1.json
```

## World Signal Foundation (1.6.8)

`source-packs/world-core-v1.json` contains 9 curated global detection sources:

- BBC World, Business and Technology RSS
- Al Jazeera English RSS
- United Nations News RSS
- GDACS global disaster alerts
- USGS significant earthquakes
- WHO Disease Outbreak News
- ICAO Newsroom

All nine world sources use `region: WORLD`, `worldSignalEnabled=true` and `autoCollect=false`. The world pack is imported after the Maldives pack when source-pack auto import is enabled.

Optional variables:

```text
ARGUS_WORLD_SOURCE_PACK_AUTO_IMPORT=true
ARGUS_WORLD_SOURCE_PACK_PATH=source-packs/world-core-v1.json
```

If `ARGUS_WORLD_SOURCE_PACK_AUTO_IMPORT` is not set, it follows `ARGUS_SOURCE_PACK_AUTO_IMPORT`.

World signal flow:

```text
world RSS/web source
→ cheap title/description prefilter
→ deterministic full article extraction only for plausible candidates
→ World Impact Gate
   ├ pass  → existing /api/argus/package → DeepSeek cleaning → Atlas + Samuga
   ├ watch → persistent correlation observation, no AI call
   └ reject → seen/filter, no AI call
```

Default thresholds are candidate floor 25, watch 50, publish 70. Global media sources require corroboration from a different source before passing, even when their impact score is high. Authoritative high-signal feeds such as GDACS, USGS significant earthquakes and WHO Disease Outbreak News can pass directly when their content matches the high-signal profile.

The gate boosts major war/escalation, coups/state crises, major disasters, election/power changes, shipping/energy disruptions, aviation system disruptions, outbreaks, systemic financial shocks, critical cyber events and major technology/AI developments. Extra weight is applied to India, Sri Lanka, the Indian Ocean, Gulf/Red Sea/Hormuz and nearby South Asian events because of likely Maldives relevance.

Noise penalties suppress sports, celebrity/entertainment, opinion/explainers, routine meetings, ordinary local crime and lifestyle content.

Cross-source watch observations are stored in the existing collector state and matched deterministically by headline/body tokens within the configured correlation window. A second credible source can promote a WATCH event into PASS without invoking AI for the first observation.

Observability logs:

```text
[WORLD_SIGNAL_PASS]
[WORLD_SIGNAL_WATCH]
```

Dry-runs return `world_filtered_pre_ai` and `world_watch_pre_ai` decisions with scores/reasons so thresholds can be tuned before enabling any world source.

## Web/RSS Collector

Keep it disabled for the first deployment check:

```text
ARGUS_SERVER_COLLECTORS_ENABLED=false
```

Status:

```text
GET /api/argus/collectors/status
```

Test one source safely:

```text
POST /api/argus/collectors/poll/:sourceId?dryRun=true
```

When ready for automatic collection:

```text
ARGUS_SERVER_COLLECTORS_ENABLED=true
ARGUS_COLLECTOR_CYCLE_INTERVAL_MS=60000
ARGUS_COLLECTOR_FETCH_TIMEOUT_MS=15000
ARGUS_COLLECTOR_MAX_CONCURRENCY=3
```

First live poll uses `mark_seen` bootstrap so current homepage items are not dumped into the feed as a backlog.

## Web extraction

No new npm parsing dependencies are required. The collector uses deterministic extraction from:

1. JSON-LD `NewsArticle` / `Article`
2. embedded `application/json` article-shaped state
3. OpenGraph metadata
4. canonical links
5. `<article>` / `<main>` paragraphs
6. targeted article/news/content containers
7. source-specific adapter hooks when a site needs deterministic special handling
8. conservative paragraph fallback

Thaana is preserved as Unicode source text. The server collector does not rewrite or translate it. Article bodies also pass configurable minimum length/word validation before submission.

For the legacy Maldives Meteorological Service news source, discovery is pinned to `/news`, only `/single-news/<id>` URLs are admitted, and downloads/service/navigation paths are rejected before materialization. Dedicated routine weather and tide modes do not use generic article discovery; they parse the official fixed product pages deterministically.

## RSS/Atom

Registry entries can use:

```json
{
  "platform": "rss",
  "collector": "rss",
  "url": "https://example.com/feed.xml",
  "collectorConfig": {
    "mode": "rss",
    "feedUrl": "https://example.com/feed.xml"
  }
}
```

RSS content is used directly when sufficiently complete; otherwise ARGUS fetches the linked article and runs normal deterministic extraction.

## Failure model

One source cannot block another. Each source has its own:

- health status
- failure count
- retry/backoff timestamp
- persistent seen URLs

A capture is only marked seen after the existing ARGUS `/api/argus/package` endpoint accepts it. Unusable article shells are not permanently marked seen, allowing a later retry if the publisher fills the same URL with real body content.

Manual dry-runs may return `preview_stale` for validated older articles so extraction can be verified without weakening the production age filter.

## Health

- `GET /`
- `GET /health`
- `GET /api/argus/events/stats` with `x-argus-secret`
- `GET /api/argus/collectors/status` with `x-argus-secret`

## Compatibility

Android remains unchanged. `argus.raw.v1` remains the capture contract.


## Atlas Wire bridge (1.6.4)

Optional Railway variables:

- `ATLAS_WIRE_INGEST_URL` — use `https://atlaswire.up.railway.app` or the full `/api/internal/atlas-wire/ingest` URL.
- `ATLAS_WIRE_INGEST_SECRET` — must match Atlas Wire `ATLAS_INGEST_SECRET`.
- `ATLAS_RETRY_INTERVAL_MS` — optional, defaults to 30000.
- `ATLAS_RETRY_BATCH` — optional, defaults to 25.

Behavior:

1. ARGUS normalizes an incoming capture.
2. ARGUS persists an Atlas-forward record before AI cleaning.
3. Atlas forwarding runs independently and never blocks the Android/test-group/Samuga path.
4. Atlas receives source headline, full body as internal evidence, source/link metadata, language/region hints and the RAW ARGUS payload.
5. Atlas API idempotency prevents duplicate public posts.
6. Failed Atlas forwards retry durably with backoff.
7. Samuga event suppression does not suppress Atlas; Atlas remains a source-report wire.

Atlas is intentionally optional: missing Atlas variables do not make ARGUS `/health` fail.

## World Signal Quality Hardening (1.6.9)

The first production USGS dry-run proved the World pipeline but exposed an over-broad earthquake rule: a remote M5.6 event could pass solely because the source was authoritative and the headline contained "earthquake". Version 1.6.9 fixes that before any world collectors are enabled.

USGS now uses its official GeoJSON programmatic feed rather than scraping the browser event page. ARGUS preserves structured magnitude, place, coordinates, depth, PAGER alert level, MMI, felt reports, tsunami flag, USGS significance and event timestamps. The World Impact Gate uses those fields directly.

Low-impact remote earthquakes are rejected before AI. Earthquakes become direct authoritative PASS signals only when they meet material impact criteria such as M7+, PAGER yellow/orange/red, or the USGS tsunami flag. M6.0–6.9 events can remain WATCH depending on other impact fields rather than automatically reaching Atlas/Samuga.


## USGS Structured Payload Hotfix (1.6.10)

The first live 1.6.9 USGS GeoJSON dry-run reached the structured `usgs_geojson` collector but failed while constructing the accepted earthquake payload with `earthquake is not defined`. The parser and World Signal gate were working; the failure was a single shorthand-property reference in the structured payload metadata. Version 1.6.10 changes that field to `earthquake: quake` and adds a passing M7.2 dry-run regression so payload construction is exercised in tests, not only low-impact rejection. No Android, Maldives, MMS, Atlas bridge, Samuga routing, source-pack, or collector enablement behavior changes.
