# Account dashboard

`/dashboard?tab=developer` is the creator workspace inside the regular account dashboard.
There is no separate developer login or automatic role assignment. New developer profiles
activate immediately, without a verification badge. Publishing, file distribution,
version changes, financial reports and new event tracking are intentionally unavailable.

## Navigation

Tabs: overview, library, favorites, wishlist, collections, reviews, developer, settings.
Unknown tabs fall back to overview. The authenticated layout validates the session before
rendering any account content. Login accepts only local `/dashboard` return addresses.
Legacy library/favorites/wishlist and developer routes redirect into this workspace.

Developer URL options: `profile` (owned profile UUID), `plugin` (plugin UUID), `view`
(analytics, versions, profile), `range` (7, 30, 90, 365, all), `page` (one-based).
Plugin-specific requests always use page 1. Profile lists support multiple pre-existing
owned profiles; onboarding itself is idempotent per account and does not add duplicates.

## Data and authorization

- Ordinary account operations use the logged-in Supabase client and RLS. Queries scope
  user IDs explicitly. Account caches include user IDs and clear on login/logout.
- `save_developer_profile(_input, _profile_id?)` is a security-invoker RPC delegating to
  a private, session-authorized function. It validates and whitelists profile fields,
  serializes concurrent creation per owner, and saves private evidence atomically.
- Direct authenticated INSERT/UPDATE on developer profiles is revoked. Owner and Stripe
  fields cannot be set through the RPC. Existing administrative service access remains.
- Evidence lives in `developer_profile_evidence`, readable by its owner and administrators,
  and is excluded from public developer profiles.
- The public `avatars` bucket accepts JPEG, PNG and WebP up to 2 MB. Insert/delete/list
  policies restrict authenticated users to their own UUID directory. New uploads use unique
  names; failed profile saves remove the new upload. Existing avatars are not deleted on edits.
- `developer_dashboard(_developer_id, _plugin_id?, _range?, _page?)` returns totals, a page of
  20 plugin summaries, recorded event series, up to 20 recent reviews and version metadata.
  Its private implementation validates the current profile owner and plugin relationship.
  It returns no individual recipient identities, file paths or financial data.
- Review updates are limited to rating, title and body at the database privilege level.

## Analytics semantics

Lifetime totals come from existing plugin counters. Ratings are weighted by review count.
Recorded history uses `plugin_analytics_events` joined to currently owned plugins. Short
ranges are daily UTC buckets; 365/all use monthly UTC buckets. Downloads in the last 30 days
are a rolling event count. Only dates with recorded events are returned.

Coverage is unknown because collection was not instrumented by this change. An empty
history is unavailable, not evidence of zero activity. No historical values are synthesized
from counters. Unique views, library growth, licenses and downloads per version are marked
unavailable. Outbound clicks are not downloads. Finance is hidden while payments are absent.

## Verification

Run `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
Run `supabase/tests/account_dashboard.sql` against a compatible database: it creates
two disposable identities inside a transaction and rolls everything back, verifying
authorization, duplicate onboarding, slug uniqueness, ownership/Stripe protection,
avatar policies, aggregate totals, weighted ratings, ranges and plugin filtering.

Browser smoke scripts require Playwright with Chrome and an explicitly disposable
test account. Credentials must remain outside git (for example `.wrangler/dashboard-e2e.json`).
Run `node scripts/dashboard-smoke.mjs <credentials.json> <base-url>` for onboarding and empty
account flows. The analytics script expects 21 private plugin fixtures owned by that account,
including `Dashboard private fixture 1`, one version, review, favorite and wishlist entry.
These scripts must never be pointed at a real user's credentials. Remove test avatars,
plugins and the disposable auth account after the checks.

Deploy migrations before the frontend. The dashboard uses authenticated RPCs and does not
require a Cloudflare service-role secret. The separate admin panel retains its existing
server configuration requirements.
