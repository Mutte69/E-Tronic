# ARGUS Relay 1.6.5 — MET CAP Alerts

## Why this build exists

MMS screenshot capture is not reliable enough for weather intelligence. The official Maldives Meteorological Service is registered by the World Meteorological Organization as an authoritative CAP issuer for Maldives, with the CAP feed:

`https://cap.meteorology.gov.mv/rss/alerts/`

This build adds a deterministic CAP path to ARGUS Relay. Screenshots/OCR are not required for MET alerts.

## Source registry changes

- Added `mv-met-cap-alerts`.
- Shares `entityId: mv-met` with the existing MMS website record.
- Collector type remains `rss` for scheduler compatibility, with `collectorConfig.mode=cap`.
- CAP feed polling interval is configured at 60 seconds.
- `autoCollect=false` until production dry-run verification.
- Legacy MMS `/news` collector remains available for manual investigation but now has `autoCollect=false`.
- Maldives source pack now contains 38 source records.

## CAP parser

The collector now recognizes both:

1. RSS/Atom feeds whose entries link to CAP XML documents.
2. A direct CAP `<alert>` XML response.

Parsed CAP fields include:

- `identifier`, `sender`, `sent`
- `status`, `msgType`, `scope`
- `references`, `incidents`
- language/category/event/response type
- urgency/severity/certainty
- effective/onset/expires
- headline/description/instruction/web/contact
- parameters/event codes
- area descriptions, polygons, circles and geocodes

MMS color names (`white`, `yellow`, `orange`, `red`) are detected only when explicitly present in CAP text/parameters/event codes. They are not inferred from severity.

## Public/actionable CAP rules

ARGUS accepts as public alert candidates only:

- `status=Actual`
- `scope=Public`
- `msgType=Alert|Update|Cancel`

Exercise/Test/System/Draft messages and Restricted/Private CAP messages are deterministically skipped. Ack/Error messages are not public alert candidates. Non-actionable CAP messages are marked non-retryable so they cannot poison the collector queue.

`references` are preserved so Update/Cancel messages can be correlated with prior alerts.

## Deterministic payload

CAP captures enter `/api/argus/package` as:

- `contentType=cap_alert`
- `eventType=weather_alert`
- `metadata.deterministicStructured=true`

The Relay skips DeepSeek cleaning for CAP so authoritative fields are not rewritten. CAP can still participate in ARGUS event intelligence and Atlas forwarding.

## Atlas Wire behavior

- CAP Alert/Update/Cancel is categorized as `weather_alert`.
- Explicit MMS red alert remains breaking.
- Explicit MMS orange remains high.
- Standard CAP `Extreme` + Immediate/Expected + Observed/Likely can promote to breaking.
- Standard CAP `Severe` + Immediate/Expected can promote to high.
- Routine/less-severe weather is not automatically promoted to breaking.

## Safety

`ARGUS_SERVER_COLLECTORS_ENABLED=false` must remain in production until Railway verification.

This build does **not** claim the live MMS feed item path is proven yet. Local CAP/RSS fixtures pass, and WMO confirms the official feed endpoint, but a real Railway dry-run is still required. If the feed is empty because MMS has no active alert, connectivity/format can be verified but a live alert item must be observed later before claiming end-to-end live CAP alert extraction is proven.
