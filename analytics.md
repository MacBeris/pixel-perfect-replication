# ExtendShare analytics

## Metric definitions

- **View**: a rendered public page for an approved, visible plugin. Developer private
  previews, administrators, unpublished/removed plugins and dashboard reads are excluded.
- **Download**: access to a hosted ZIP was authorized and a signed URL was issued. Owner and
  administrator test downloads are excluded.
- **External click**: ExtendShare authorized navigation from an external listing to its canonical
  marketplace URL. It is not a download and never changes `downloads_count`.
- **Rating / reviews**: aggregates of `active` ExtendShare reviews only. Imported source ratings,
  installs and downloads stay in the separate `source_*` fields.

## Data flow

Public page views and external clicks call a TanStack server function. It validates the input,
verifies an optional Supabase access token, hashes a random first-party visitor ID and calls the
service-only `record_plugin_interaction` RPC. The RPC derives plugin/developer identity, validates
publication state and event type, excludes owner/admin traffic, deduplicates for 30 minutes, then
atomically inserts the event and updates the view counter where applicable.

Hosted downloads continue through the private Storage signed-URL flow. `record_download` runs
only after URL creation and uses the authenticated account as its 10-minute deduplication key.
Review eligibility is derived from that recorded download; external navigation alone never makes
a user eligible to review.

`developer_dashboard` reads lightweight lifetime counters for cards and event rows only for the
selected plugin/range. It returns daily buckets for 7/30/90 days and monthly buckets for one year
and all time. Zero-filled buckets begin only at the recorded tracking boundary. Metric-specific
coverage prevents older download history from pretending that view tracking existed at that time.

## Privacy and security

- Browser code cannot insert, update or delete analytics events.
- The interaction RPC is executable only by `service_role` and accepts only `page_view` or
  `outbound_click`.
- Raw visitor IDs and IP addresses are not stored. Postgres receives a one-way SHA-256 session
  key solely for short-window deduplication.
- Developer RPCs validate the signed-in owner and expose aggregates, never viewer/downloader
  identities.
- Reviews are written through the server-only validated RPC; direct authenticated writes are
  revoked.

The short-window visitor key is intentionally a lightweight abuse control, not a fingerprinting
system. Determined clients can clear browser storage; stronger edge rate limiting can be added in
Cloudflare later without changing the event model.
