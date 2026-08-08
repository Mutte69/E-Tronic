# ARGUS Relay 1.6.0 — Web/RSS Collector Foundation

Build 2 extends the working 1.5.0 source-registry relay without changing the Android Telegram/Viber capture path.

## What is new

- Persistent server-side Web/RSS collector state.
- Deterministic HTML link discovery and article extraction using Node built-ins only.
- RSS/Atom item parsing.
- OpenGraph, canonical URL and JSON-LD `NewsArticle` extraction.
- Thaana/Dhivehi-safe Unicode extraction; the collector never transliterates or rewrites source text.
- Per-source isolation: a broken source cannot stop the collector cycle.
- Per-source health, failures and next-check timestamps stored in the Source Registry.
- Seen-URL persistence prevents duplicate submission after redeploys.
- Safe bootstrap: first live poll marks currently visible items as seen instead of flooding ARGUS with a backlog.
- Manual dry-run polling for a single source before live submission.
- Bundled `maldives-core-v1` source pack with 37 Maldives web sources.
- Optional idempotent source-pack auto-import on startup.

## Existing pipeline remains authoritative

Server-collected articles are submitted back into the existing `/api/argus/package` endpoint. Therefore Web/RSS captures use the same normalize → DeepSeek cleaning → Telegram test delivery → event intelligence → Samuga flow as Android captures.

No Android files or payload contracts are changed.

## New Railway variables

Recommended for persistence:

```text
ARGUS_COLLECTOR_STATE_PATH=/data/argus-collector-state.json
```

To import the bundled source pack:

```text
ARGUS_SOURCE_PACK_AUTO_IMPORT=true
ARGUS_SOURCE_PACK_PATH=source-packs/maldives-core-v1.json
```

Keep automatic collection OFF for the first deployment verification:

```text
ARGUS_SERVER_COLLECTORS_ENABLED=false
```

Collector tuning, when automatic collection is later enabled:

```text
ARGUS_COLLECTOR_CYCLE_INTERVAL_MS=60000
ARGUS_COLLECTOR_FETCH_TIMEOUT_MS=15000
ARGUS_COLLECTOR_MAX_CONCURRENCY=3
```

## New admin endpoints

All require the existing `x-argus-secret` header.

```text
GET  /api/argus/collectors/status
POST /api/argus/collectors/poll/:sourceId?dryRun=true
```

The manual poll defaults to `dryRun=true`. A dry run fetches/discovers/extracts current candidates but does not submit them into the ARGUS delivery pipeline and does not change the persistent seen set.

## Bootstrap behavior

Every bundled source uses:

```json
"bootstrapMode": "mark_seen"
```

On the first live automatic poll, currently visible items are recorded as already seen and are not published. Future newly discovered URLs can then enter ARGUS. This avoids a deployment-time burst of old articles.

## Failure isolation

Each source has independent health state:

- `healthy`
- `error`
- `lastCheckedAt`
- `lastSuccessAt`
- `lastError`
- `consecutiveFailures`
- `nextCheckAt`

A failed source receives backoff while other sources continue.

## Source pack

`source-packs/maldives-core-v1.json` contains 37 Maldives web sources across:

- emergency / weather / public safety
- health
- government
- finance / economy
- elections / parliament / accountability
- transport / utilities
- major Maldives newsrooms

Telegram and Viber sources remain on the existing Android notification collector and are intentionally not duplicated in this pack.

## Important limitation

This is the generic collector foundation, not a claim that every website has the same HTML structure. The extractor prefers structured data and standard article markup, then falls back conservatively. Sources that need special selectors/API adapters can be hardened individually after Railway dry-run results are observed.

RSS support is available when a registry entry uses `collector: "rss"` or supplies an RSS/Atom feed URL in `collectorConfig.feedUrl`.
