# ARGUS Relay 1.6.2 — MET Discovery Hotfix

Date: 2026-08-08

## Why this hotfix exists

The first real Railway dry-run of Relay 1.6.1 authenticated successfully but returned `discovered=0` for Maldives Meteorological Service (MMS/MET), while the live `/news` page still contained news items.

## Changes

- Preserve all Relay 1.6.1 Web Collector Hardening behavior.
- Keep automatic server collectors disabled by default.
- Expand the MMS/MET allowlist to accept both:
  - `/single-news/<id>`
  - `/index.php/single-news/<id>`
- Permit an explicitly allowlisted candidate URL to continue to article materialization even when its `<a>` element has empty or very short visible text.
- Keep strict MMS exclusions for downloads, climate-data, service, about, contact, navigation and other non-news pages.
- Continue to require article-page headline/body extraction and validation before a candidate can be previewed/submitted.
- Android collector remains unchanged.

## Safety rationale

Allowing short/empty anchor text is restricted to URLs that already match a source-specific `includeUrlPatterns` allowlist. It does not loosen generic discovery for unconfigured sources.

## Verification

- `npm test` passed.
- `npm run check` passed.
- 37-source pack test passed.
- New regression coverage verifies MMS image/icon-only article anchors and `/index.php/single-news/` URLs are discovered while `/downloads/` remains rejected.
