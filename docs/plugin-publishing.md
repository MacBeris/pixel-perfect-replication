# Plugin publishing, stage 1

Account dashboard: `/dashboard?tab=developer&view=create`, or `view=edit&plugin=<uuid>`.
The first Basics save creates an idempotent draft; step changes and Save draft persist progress.
Existing developer profiles, categories, tags, plugin_assets and plugin_versions are reused.
New tags (max five per save) are validated and added to the existing catalog. No video/Markdown editor.

## Backend and authorization

`publishingRequest` is a POST TanStack Start server function. It verifies each access token with
Supabase Auth getUser, then calls service-only `publishing_action`. Actor IDs never come from
the browser. The RPC locks plugin rows and uses field whitelists, owner checks and allowed
state transitions. The minimum account age is five minutes (Auth created_at, not metadata).
Direct client writes to plugins, versions, assets and relations are revoked, including TRUNCATE.
Existing admin actions continue through their service client and transactional audit.

Draft -> pending_review; version draft -> pending_review. The existing admin approval action
publishes the first verified version and synchronizes current_version atomically. A partial
unique index allows only one is_current version. Version snapshots are included in audit logs.
Rejected submissions can be revised. Pending/published/suspended content is not author-editable.

## Files

Public `plugin-assets`: JPEG/PNG/WebP <=5 MiB, max10 screenshots. Draft media URLs are public.
Private `plugin-files`: non-empty ZIP <=50 MiB. Original name/size and reserved paths live in
server-only plugin_uploads. Versions reuse file_path/file_size and add file_verified_at.
No client object policies exist for these buckets. The server issues non-upsert signed upload
tokens for reserved staging paths, then moves the object to an immutable unique final path
BEFORE validating server-observed size, MIME and format signature. This prevents token reuse
from altering a validated package. Failed validation never attaches the file to a version.
Cleanup removes up to10 of the actor's unfinished uploads older than three hours when another
upload is requested; a scheduled global janitor and cleanup of replaced media are deferred.
Signature validation is NOT malware scanning or full archive inspection.

## Distribution and metrics

New hosted submissions are free. Existing paid/freemium packages require a paid or
partially_refunded purchase; refunds revoke access. No new payment integration is added.
Public download requires approved plugin + published/current/verified version. Owners and
admins may test their own/authorized packages without incrementing public counters.
The server derives the path and returns a 60-second signed URL with a readable filename.
Signed URLs are bearer links, not one-time links, and stay valid until expiry.
Download events count access grants, not completed transfers. Plugin row locks serialize
event/counter updates; same actor/plugin counts once per10 minutes. No version-level tracking.
External clicks are distinct events, deduplicated for signed-in visitors. Anonymous visitors
can follow external URLs without a new anonymous tracking system.

## Runtime and verification

Uses existing server-only SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY on Cloudflare, never VITE secrets.
`node --test scripts/publishing-validation.test.mjs`: format validation regression tests.
`supabase/tests/plugin_publishing.sql`: transactional fixtures rolled back; ownership, direct API
grants, age limit, state transitions, moderation, purchases/refunds and deduplication.
`scripts/publishing-smoke.mjs`: browser workflow against disposable accounts, never real customer accounts.
`scripts/publishing-api-smoke.mjs`: live cross-account denial, path injection, private Storage,
direct signing denial and signed URL expiry. Tests use an ephemeral browser, not the user's session.

Validated on Cloudflare: creator upload (logo/screenshot/ZIP), submit, existing admin approval,
viewer download and deduplication. Live testing also repaired the pre-existing stale
`public.owns_developer` reference in the private plugin-ownership RLS helper.

Deferred: subsequent release uploads, paid authoring, checkout, antivirus scanning, global janitor,
one-time downloads and per-version analytics. Public plugin counters retain their historic source.

## Covers, onboarding drafts and reviews

Cover uses the existing plugin_assets table (asset_type=cover) and the same signed image upload,
signature and 5 MiB limits. It is independent of logo/screenshots and replaces the previous cover.
Listing cards use it when available. Publishing preview shows current unsaved text and verified assets.
Onboarding text is stored locally per account; the selected avatar survives dashboard navigation in
memory (reselect it after a full page reload). Cancel or successful activation clears the draft.
Profile creation remains idempotent in the existing database RPC.

Review creation uses a server-only save_plugin_review RPC after validating the Auth user. Hosted
eligibility uses the existing server-recorded download access grant, not a client flag or an external
click. It does not prove a completed file transfer. External listings retain paid/partially_refunded
purchase eligibility. One review per account/plugin is enforced by the existing unique constraint.
Updates never alter moderation status; hidden/removed reviews cannot be revived. Authenticated
clients cannot insert reviews or call the privileged RPC. Existing column-scoped owner edits remain.
The review list is paginated by 20 and the edit form retains existing text and rating.
