# ARGUS Relay 1.4.0 Release Notes

## Version

`1.4.0-event-intelligence`

## Added

- Persistent real-world event clustering across differently written English and Dhivehi coverage.
- Four routing decisions: new event, event update, supporting coverage and bypass.
- Meaning-based comparison using actors, actions, dates, location, figures, quotes and factual developments.
- Conservative suppression: uncertain reports continue to editorial.
- Raw + clean append-only capture archive.
- Persistent event store and processed-capture index.
- Retry-safe pending delivery state.
- Optional Telegram notices for suppressed supporting coverage.
- Event statistics endpoint.

## Preserved

- Existing `argus.raw.v1` Android payload contract.
- Relay authentication.
- Telegram image and document fallback.
- Samuga News Bot forwarding.
- DeepSeek exact-line hard cleaning.
- Raw capture and metadata preservation.
- Weather bypass behavior.

## Migration

1. Deploy the new relay source.
2. Keep all existing Railway variables.
3. Add a Railway Volume mounted at `/data`.
4. Add `EVENT_STORE_PATH=/data/argus-events.json`.
5. Add `CAPTURE_ARCHIVE_PATH=/data/argus-captures.jsonl`.
6. Leave `TELEGRAM_SUPPORTING_COVERAGE=false` to avoid repeated-story noise.

## Testing completed

- Node.js syntax validation passed.
- Package manifest validation passed.
- ZIP integrity test passed.
- Existing endpoint and payload names preserved by source inspection.

## Testing still required on Railway

- Live DeepSeek cleaner response.
- Cross-language same-event matching with actual English/Dhivehi outlet pairs.
- Railway Volume persistence across redeploy.
- Samuga ingest behavior for `event_update` metadata.
- Telegram suppression and forwarding decisions.

## Known issues

- Initial event matching begins with no historical clusters and improves as new captures arrive.
- Event comparison is limited to recent candidate clusters, default 12 events within 72 hours.
- JSONL capture archives require future rotation or migration to database/object storage as volume grows.
