# ARGUS Relay 1.5.0 — Source Registry Foundation

This release adds the central server-side source registry and bulk import foundation without changing the Android Telegram/Viber collector contract.

## Added

- Persistent source registry at `ARGUS_SOURCE_STORE_PATH` (default `data/argus-sources.json`).
- One entity can own many source channels (web, Telegram, X, Facebook, RSS, etc.).
- Source metadata: platform, collector, source type, region/country, languages, P0-P3 priority, reliability, tags, notification title match, enabled state and collector health placeholders.
- Secure source CRUD API using the existing `x-argus-secret` header.
- Bulk JSON import and CSV import.
- Import upserts an existing source by ID or matching platform+URL instead of creating duplicates.
- `dryRun=true` import preview.
- Source registry statistics exposed in `/`, `/health`, and `/api/argus/sources/stats`.

## API

- `GET /api/argus/sources`
- `GET /api/argus/sources/stats`
- `GET /api/argus/sources/:id`
- `POST /api/argus/sources`
- `POST /api/argus/sources/import`
- `PATCH /api/argus/sources/:id`
- `DELETE /api/argus/sources/:id`

All endpoints require the existing `x-argus-secret`.

## Bulk JSON

```json
{
  "sources": [
    {
      "name": "Maldives Police Service",
      "entityId": "mv-police",
      "platform": "web",
      "url": "https://www.police.gov.mv/",
      "collector": "web",
      "sourceType": "public_safety",
      "region": "MV",
      "priority": "P0",
      "reliability": "official",
      "enabled": true
    }
  ]
}
```

## CSV headers

`name,entity_id,platform,url,collector,source_type,region,country,languages,priority,reliability,enabled,notification_title_match,tags,notes`

## Railway

For persistence, set:

`ARGUS_SOURCE_STORE_PATH=/data/argus-sources.json`

and keep the existing Railway volume mounted at `/data`.

## Compatibility

- Android payload endpoint remains `/api/argus/package`.
- No Android APK change required.
- Existing DeepSeek cleaning, poison-queue hardening, Telegram test delivery, event intelligence and Samuga forwarding are preserved.
- This release only builds the registry/import foundation. It does not yet crawl website/RSS/X/Facebook sources.
