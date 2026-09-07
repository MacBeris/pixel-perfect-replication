# External plugin ingestion

Extendly imports trusted marketplace listings into the existing `plugins` table. Imported rows are
`external_listing`, have no developer owner, and are claimable. The source payload is retained in
`raw_source_items`; each CLI execution is summarized in `import_runs`.

## Run locally

Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`. The secret key is server-only and must
never use a `VITE_` prefix.

```bash
npm run ingest -- --source wordpress --pages 5
npm run ingest -- --source wordpress --limit 100
npm run ingest -- --source blender --limit 100
npm run ingest -- --source wordpress --limit 10 --dry-run --verbose
npm run ingest -- --source wordpress --verify --limit 100
npm run ingest -- --source blender --verify
```

Options: `--source`, `--limit`, `--pages`, `--dry-run`, `--force`, `--verbose`, and `--verify`.
`--pages` applies to WordPress; Blender exposes one complete v1 index. `--force` re-normalizes an
unchanged payload. Dry runs do not require database credentials and perform no writes.

## Adapter contract

Adapters implement `SourceAdapter` in `scripts/ingest/types.ts`: list retrieval, detail retrieval,
normalization, external identity and canonical source URL. Registering a new adapter does not alter
the engine. Normalized facts are nullable; adapters must never invent ratings, price, author,
compatibility, installs or dates. Optional enrichment is a no-op interface for future categorization
and translation, not a source of factual values.

WordPress uses the official Plugins API. Blender uses the official Extensions v1 JSON index. Images
remain remote URLs; archives are never copied to Extendly Storage. External ratings and installs are
stored separately from Extendly reviews and downloads.

Chrome Web Store and Shopify App Store adapters are deliberate stubs. Both require a separate source
and terms review: their storefronts can change, expose incomplete public data, and may enforce bot
controls. Extendly will not bypass CAPTCHAs, Cloudflare or anti-automation controls.

## Updates, claims and availability

`(source, external_id)` is the immutable identity. A canonical SHA-256 hash skips unchanged writes.
Once a claim assigns `developer_id`, the importer retains new RAW responses but stops overwriting the
owner-managed listing.

Availability checks are explicit (`--verify`). A successful source response that confirms absence
increments `source_missing_count`. Three consecutive confirmed misses suspend and hide the listing;
timeouts, HTTP 429 and failed source requests never count. A source-managed listing that reappears is
restored automatically. Records are never deleted.

