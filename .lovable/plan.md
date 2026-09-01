# Extendly — plan architektury i wdrożenia

Marketplace pluginów/rozszerzeń dla 10 platform (WordPress, Blender, Unity, Adobe, Figma, VS Code, Chrome, Shopify, Unreal Engine 5, PrestaShop).

## 1. Architektura

- Frontend: React 19 + TypeScript (strict), TanStack Start/Router (routing plikowy w `src/routes`), Tailwind v4, shadcn/ui.
- Backend/dane: Supabase (PostgreSQL, Auth, Storage, RLS). Do projektu jest już podłączony projekt Supabase `khqehhnksllttafoepni` — jeśli to nie jest Twoja baza **ExtendlyBaza**, podepnij ją zanim ruszymy z migracjami.
- Logika serwerowa: server functions frameworka (bezpieczne operacje: signed URL do plików, Stripe Checkout, webhooki w `/api/public/*`). Sekrety wyłącznie server-side.
- Wyszukiwarka: PostgreSQL Full Text Search ukryta za jednym serwisem `services/search` — wymiana silnika w przyszłości bez ruszania UI.
- Struktura kodu: `components/ui`, `features/<domena>`, `hooks`, `lib`, `services` (warstwa dostępu do danych — jedyne miejsce z zapytaniami Supabase), `types`.
- i18n-ready: teksty w warstwie `lib/i18n` (na razie tylko `en`).
- Design: minimalistyczny, techniczny (Linear/Vercel/GitHub Marketplace), tokeny semantyczne w `src/styles.css`, light/dark/system.

## 2. Model danych (główne tabele)

- `profiles` (1:1 z auth.users), `user_roles` (osobna tabela + funkcja `has_role`, bez ról w profilu).
- `developer_profiles` (slug, typ: individual/company, linki, stripe_account_id), `developer_members` (przyszłe zespoły).
- `platforms`, `categories` (drzewo przez `parent_id`), `tags`.
- `plugins` — pełna lista pól ze specyfikacji + `platform_id`, `developer_id`, `listing_type` (`direct_sale` | `external_listing`), `moderation_status`, `is_claimable`, liczniki i `search_vector`.
- `plugin_categories`, `plugin_tags`, `plugin_assets` (screenshoty/logo), `plugin_versions` (pliki, changelog, `is_current`).
- `purchases`, `transactions` (sale / platform_fee / refund / payout / adjustment), `developer_balances`, `payouts`.
- `reviews` (unique `(plugin_id, user_id)` dla aktywnych, `verified_purchase`), `favorites`, `wishlists`, `collections`, `collection_plugins`.
- `claims`, `reports`, `plugin_analytics_events`, `plugin_change_requests` (wykrywanie zmian krytycznych wymagających ponownej moderacji).

## 3. Główne relacje

```text
auth.users 1─1 profiles 1─n user_roles
profiles 1─n developer_profiles ─n developer_members
platforms 1─n plugins n─n categories/tags
plugins 1─n plugin_versions / plugin_assets / reviews / claims / reports / analytics_events
profiles 1─n purchases n─1 plugins ; purchases 1─n transactions
developer_profiles 1─1 developer_balances 1─n payouts
profiles 1─n collections 1─n collection_plugins n─1 plugins
```

Reguły: UUID, FK z ON DELETE, indeksy (slug, platform_id, status, GIN na search_vector), CHECK na cenach/ratingu, triggery aktualizujące liczniki i `rating_average` z aktywnych recenzji. Każda tabela `public` dostaje jawne GRANT-y + RLS.

## 4. Buckety Storage

- `plugin-assets` — publiczny (logo, screenshoty).
- `plugin-files` — prywatny (pliki wersji; pobranie wyłącznie przez signed URL po weryfikacji zakupu server-side).
- `developer-assets` — publiczny (avatary/logo developerów).

## 5. Kolejność wdrożenia (etapy ze specyfikacji)

1. Design system, layout, routing, Auth (email + Google + GitHub), schemat bazy + RLS, homepage.
2. Platformy, kategorie, katalog `/plugins`, FTS, filtry, sortowanie, strona pluginu.
3. Profil użytkownika, favorites, wishlist, collections.
4. Profil i dashboard developera, submit plugin, wersje, Storage.
5. Admin, moderacja, claims, reports.
6. Stripe + Connect, purchases, transactions, balances, payouts, `/library`, bezpieczne pobieranie.
7. Reviews, analytics, SEO, responsywność, przegląd bezpieczeństwa.

Każdy etap kończy się działającą aplikacją; wszystkie zmiany schematu zapisywane jako migracje SQL w repo.

## 6. Do skonfigurowania przez Ciebie (później)

- Supabase Auth: Google OAuth i GitHub OAuth (client id/secret + redirect URL) — kod przygotuję wcześniej.
- Stripe: secret key, webhook secret, Stripe Connect (typ konta, onboarding) — prowizja 10% / 90% dla developera.
- Ewentualne podpięcie własnej bazy ExtendlyBaza i repozytorium GitHub.

## 7. Zakres pierwszej implementacji (po akceptacji)

ETAP 1 w całości: tokeny designu + light/dark/system, layout (header z wyszukiwarką, footer), routing publiczny i chroniony, strony auth, pełna migracja schematu z RLS i seedem platform/kategorii, homepage z sekcjami (hero, browse by platform, trending, popular, new, top rated, free, open source, featured categories).
