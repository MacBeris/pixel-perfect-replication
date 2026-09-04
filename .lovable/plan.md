# Extendly — plan dalszej rozbudowy

Plan wynika z audytu obecnego stanu: baza danych, RLS, moderacja i katalog publiczny są gotowe, natomiast brakuje całej ścieżki „użytkownik → developer → publikacja wtyczki → pliki → sprzedaż" oraz zarządzania kontem.

## Etap A — Konto użytkownika i uwierzytelnianie

- Strona `/settings` (chroniona): edycja `display_name`, `username`, `avatar_url`, `bio`; zmiana hasła; wylogowanie ze wszystkich urządzeń.
- Reset hasła: link „Nie pamiętam hasła" na `/auth` + publiczna strona ustawienia nowego hasła.
- Logowanie Google i GitHub (spec wymaga OAuth) — przyciski na `/auth`, powrót na publiczną trasę, potem przekierowanie na zapamiętaną ścieżkę.
- Poprawienie linku „Sell" w nagłówku — prowadzi obecnie do katalogu, ma prowadzić do onboardingu developera.

## Etap B — Profil developera (warunek publikacji)

- `/developer/new`: formularz zakładania profilu developera (nazwa, slug, typ konta: osoba/firma/organizacja, opis, linki www/GitHub/X, avatar).
- Nadanie roli `developer` po utworzeniu profilu — wymaga bezpiecznej funkcji serwerowej (dziś `user_roles` ma tylko odczyt, nie da się nadać roli z aplikacji).
- Publiczny profil developera `/developer/$slug`: opis, linki, lista opublikowanych wtyczek.
- `/developer/settings`: edycja profilu.

## Etap C — Storage (blokada dla wszystkiego dalej)

Obecnie w projekcie nie ma żadnego bucketu, więc nie da się wgrać ani logo, ani plików wtyczki.

- `plugin-assets` — publiczny (logo, screenshoty, banery).
- `developer-assets` — publiczny (avatary developerów).
- `plugin-files` — prywatny (paczki wersji), pobieranie wyłącznie przez signed URL generowany po serwerowej weryfikacji zakupu lub darmowej licencji.
- Polityki dostępu na `storage.objects` powiązane z właścicielem wtyczki.

## Etap D — Publikacja wtyczek (dashboard developera)

- `/developer/dashboard`: lista wtyczek właściciela wraz ze statusem moderacji, licznikami i skrótami akcji.
- `/developer/plugins/new` — kreator w krokach:
  1. Podstawy: nazwa, slug, platforma, krótki opis.
  2. Opis pełny (markdown), wideo, kategorie, tagi.
  3. Media: logo + screenshoty (Storage).
  4. Model dystrybucji: `direct_sale` (cena, waluta, plik wersji) albo `external_listing` (link zewnętrzny).
  5. Pierwsza wersja: numer, changelog, kompatybilność, plik.
  6. Podsumowanie → zapis jako `draft` lub wysyłka do moderacji (`pending_review`).
- `/developer/plugins/$id/edit`: edycja; zmiany pól krytycznych (cena, platforma, plik) tworzą wpis w `plugin_change_requests` zamiast natychmiastowej publikacji.
- `/developer/plugins/$id/versions`: dodawanie wersji, oznaczanie `is_current`, archiwizacja.
- Przejmowanie wpisów: formularz `claims` na stronie wtyczki oznaczonej `is_claimable`.

## Etap E — Panel administratora (uzupełnienie)

- Zarządzanie rolami: nadawanie/odbieranie `developer` i `admin` przez funkcję z audytem (dziś niemożliwe z UI).
- Blokowanie/odblokowanie konta użytkownika.
- Moderacja `plugin_change_requests` (obecnie tabela istnieje, ale panel jej nie obsługuje).
- Ukrywanie/przywracanie recenzji z poziomu zgłoszeń.
- Paginacja i wyszukiwanie w listach (dziś twarde limity 100/200 rekordów).

## Etap F — Płatności (Stripe + Connect)

- Onboarding Stripe Connect dla developera, status `charges_enabled` / `payouts_enabled` w profilu.
- Checkout zakupu wtyczki, webhook w `/api/public/*` z weryfikacją podpisu, zapis `purchases` + `transactions` (podział 90/10).
- `developer_balances` i wnioski o wypłatę (`payouts`).
- `/library`: bezpieczne pobieranie plików po weryfikacji zakupu (dziś biblioteka jest z definicji pusta).
- Darmowe wtyczki: pobieranie bez płatności, ale z rejestrem zdarzenia.

## Etap G — Społeczność i dane

- Recenzje: dodawanie/edycja własnej recenzji, znacznik `verified_purchase`, zgłaszanie nadużyć.
- Ulubione, wishlist i kolekcje sterowane z kart wtyczek (dziś strony tylko wyświetlają dane).
- Rejestrowanie `plugin_analytics_events` (odsłony, kliknięcia wychodzące, pobrania) i wykresy w dashboardzie developera.
- SEO: dane strukturalne produktu na stronie wtyczki, sitemap, kanoniczne adresy.

## Kolejność i zależności

```text
A (konto) ──┐
            ├─> B (profil developera) ─> C (Storage) ─> D (publikacja) ─> F (płatności)
E (admin) ──┘                                              └─> G (recenzje, analityka)
```

Etap C jest twardą blokadą dla D i F — bez bucketów nie da się wgrać ani udostępnić plików.

## Szczegóły techniczne

- Nadawanie ról i onboarding developera przez `createServerFn` z weryfikacją sesji; `user_roles` pozostaje bez polityk zapisu, zmiany wyłącznie przez funkcje SECURITY DEFINER z wpisem do `admin_audit_logs`.
- Odczyty właścicielskie (szkice, wersje niepublikowane) przez server functions z `requireSupabaseAuth`; istniejące polityki RLS już pozwalają właścicielowi widzieć własne nieopublikowane rekordy.
- Uploady bezpośrednio do Storage z klienta dla plików publicznych; pliki wersji przez ścieżkę serwerową z walidacją rozmiaru i typu.
- Webhooki Stripe jako trasa serwerowa pod `/api/public/`, z weryfikacją podpisu przed jakimkolwiek zapisem.
- Nowe trasy prywatne trafiają pod `src/routes/_authenticated/`; `/admin` warto przenieść pod ten sam gate.
- Wszystkie zmiany schematu jako migracje SQL z jawnymi GRANT-ami i politykami RLS.

## Do skonfigurowania przez Ciebie

- Supabase Auth: Google i GitHub OAuth (client id/secret, redirect URL).
- Stripe: klucz tajny, sekret webhooka, konfiguracja Connect.
