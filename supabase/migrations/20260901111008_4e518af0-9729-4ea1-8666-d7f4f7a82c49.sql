-- =============== ENUMS ===============
create type public.app_role as enum ('user','developer','admin');
create type public.developer_account_type as enum ('individual','company','organization');
create type public.pricing_model as enum ('free','paid','freemium');
create type public.moderation_status as enum ('draft','pending_review','approved','rejected','suspended');
create type public.listing_type as enum ('direct_sale','external_listing');
create type public.version_status as enum ('draft','pending_review','published','archived');
create type public.purchase_status as enum ('pending','paid','refunded','partially_refunded','failed');
create type public.transaction_type as enum ('sale','platform_fee','refund','payout','adjustment');
create type public.payout_status as enum ('requested','processing','paid','failed','cancelled');
create type public.review_status as enum ('active','hidden','removed');
create type public.claim_status as enum ('pending','approved','rejected');
create type public.report_status as enum ('open','reviewing','resolved','dismissed');
create type public.report_target as enum ('plugin','review');
create type public.asset_type as enum ('logo','screenshot','banner');
create type public.analytics_event_type as enum ('page_view','outbound_click','download','purchase','favorite','wishlist_add');
create type public.change_request_status as enum ('pending','approved','rejected');

-- =============== SHARED FUNCTIONS ===============
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- =============== PROFILES / ROLES ===============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant select on public.profiles to anon;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles_public_read" on public.profiles for select using (true);
create policy "profiles_self_insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_self_update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create trigger profiles_updated_at before update on public.profiles for each row execute function public.update_updated_at_column();

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "user_roles_self_read" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- =============== DEVELOPER PROFILES ===============
create table public.developer_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  account_type public.developer_account_type not null default 'individual',
  description text,
  avatar_url text,
  website_url text,
  github_url text,
  twitter_url text,
  is_public boolean not null default true,
  stripe_account_id text,
  stripe_charges_enabled boolean not null default false,
  stripe_payouts_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index developer_profiles_owner_idx on public.developer_profiles(owner_id);
grant select, insert, update on public.developer_profiles to authenticated;
grant select on public.developer_profiles to anon;
grant all on public.developer_profiles to service_role;
alter table public.developer_profiles enable row level security;
create policy "dev_public_read" on public.developer_profiles for select using (is_public or owner_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "dev_owner_insert" on public.developer_profiles for insert to authenticated with check (owner_id = auth.uid());
create policy "dev_owner_update" on public.developer_profiles for update to authenticated using (owner_id = auth.uid() or public.has_role(auth.uid(),'admin')) with check (owner_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create trigger developer_profiles_updated_at before update on public.developer_profiles for each row execute function public.update_updated_at_column();

create table public.developer_members (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.developer_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (developer_id, user_id)
);
grant select, insert, delete on public.developer_members to authenticated;
grant all on public.developer_members to service_role;
alter table public.developer_members enable row level security;
create policy "dev_members_read" on public.developer_members for select to authenticated using (user_id = auth.uid() or exists (select 1 from public.developer_profiles d where d.id = developer_id and d.owner_id = auth.uid()) or public.has_role(auth.uid(),'admin'));
create policy "dev_members_manage" on public.developer_members for insert to authenticated with check (exists (select 1 from public.developer_profiles d where d.id = developer_id and d.owner_id = auth.uid()));
create policy "dev_members_delete" on public.developer_members for delete to authenticated using (exists (select 1 from public.developer_profiles d where d.id = developer_id and d.owner_id = auth.uid()));

create or replace function public.owns_developer(_developer_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.developer_profiles d where d.id = _developer_id and d.owner_id = auth.uid())
      or exists (select 1 from public.developer_members m where m.developer_id = _developer_id and m.user_id = auth.uid())
$$;

-- =============== TAXONOMY ===============
create table public.platforms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  icon text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.platforms to anon, authenticated;
grant all on public.platforms to service_role;
alter table public.platforms enable row level security;
create policy "platforms_read" on public.platforms for select using (active or public.has_role(auth.uid(),'admin'));
create policy "platforms_admin_write" on public.platforms for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger platforms_updated_at before update on public.platforms for each row execute function public.update_updated_at_column();

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  icon text,
  parent_id uuid references public.categories(id) on delete set null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.categories to anon, authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "categories_read" on public.categories for select using (active or public.has_role(auth.uid(),'admin'));
create policy "categories_admin_write" on public.categories for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger categories_updated_at before update on public.categories for each row execute function public.update_updated_at_column();

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);
grant select on public.tags to anon, authenticated;
grant insert on public.tags to authenticated;
grant all on public.tags to service_role;
alter table public.tags enable row level security;
create policy "tags_read" on public.tags for select using (true);
create policy "tags_auth_insert" on public.tags for insert to authenticated with check (true);

-- =============== PLUGINS ===============
create table public.plugins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  short_description text not null,
  full_description text,
  video_url text,
  platform_id uuid not null references public.platforms(id) on delete restrict,
  developer_id uuid references public.developer_profiles(id) on delete set null,
  price numeric(10,2) not null default 0 check (price >= 0),
  currency text not null default 'USD',
  pricing_model public.pricing_model not null default 'free',
  current_version text,
  compatibility text,
  license text,
  is_open_source boolean not null default false,
  website_url text,
  external_purchase_url text,
  github_url text,
  listing_type public.listing_type not null default 'direct_sale',
  is_claimable boolean not null default false,
  moderation_status public.moderation_status not null default 'draft',
  rejection_reason text,
  rating_average numeric(3,2) not null default 0 check (rating_average >= 0 and rating_average <= 5),
  reviews_count integer not null default 0,
  downloads_count integer not null default 0,
  purchases_count integer not null default 0,
  favorites_count integer not null default 0,
  wishlist_count integer not null default 0,
  views_count integer not null default 0,
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create index plugins_platform_idx on public.plugins(platform_id);
create index plugins_developer_idx on public.plugins(developer_id);
create index plugins_status_idx on public.plugins(moderation_status);
create index plugins_search_idx on public.plugins using gin(search_vector);
grant select, insert, update, delete on public.plugins to authenticated;
grant select on public.plugins to anon;
grant all on public.plugins to service_role;
alter table public.plugins enable row level security;
create policy "plugins_public_read" on public.plugins for select using (moderation_status = 'approved' or public.owns_developer(developer_id) or public.has_role(auth.uid(),'admin'));
create policy "plugins_dev_insert" on public.plugins for insert to authenticated with check (public.owns_developer(developer_id) or public.has_role(auth.uid(),'admin'));
create policy "plugins_dev_update" on public.plugins for update to authenticated using (public.owns_developer(developer_id) or public.has_role(auth.uid(),'admin')) with check (public.owns_developer(developer_id) or public.has_role(auth.uid(),'admin'));
create policy "plugins_dev_delete" on public.plugins for delete to authenticated using (public.owns_developer(developer_id) or public.has_role(auth.uid(),'admin'));
create trigger plugins_updated_at before update on public.plugins for each row execute function public.update_updated_at_column();

create or replace function public.plugins_search_vector_trigger()
returns trigger language plpgsql set search_path = public as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.name,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.short_description,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.full_description,'')), 'C');
  return new;
end; $$;
create trigger plugins_search_vector before insert or update on public.plugins for each row execute function public.plugins_search_vector_trigger();

create or replace function public.owns_plugin(_plugin_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.plugins p where p.id = _plugin_id and public.owns_developer(p.developer_id))
$$;

create or replace function public.plugin_is_public(_plugin_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.plugins p where p.id = _plugin_id and p.moderation_status = 'approved')
$$;

create table public.plugin_categories (
  plugin_id uuid not null references public.plugins(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (plugin_id, category_id)
);
grant select, insert, delete on public.plugin_categories to authenticated;
grant select on public.plugin_categories to anon;
grant all on public.plugin_categories to service_role;
alter table public.plugin_categories enable row level security;
create policy "plugin_categories_read" on public.plugin_categories for select using (public.plugin_is_public(plugin_id) or public.owns_plugin(plugin_id) or public.has_role(auth.uid(),'admin'));
create policy "plugin_categories_write" on public.plugin_categories for insert to authenticated with check (public.owns_plugin(plugin_id) or public.has_role(auth.uid(),'admin'));
create policy "plugin_categories_delete" on public.plugin_categories for delete to authenticated using (public.owns_plugin(plugin_id) or public.has_role(auth.uid(),'admin'));

create table public.plugin_tags (
  plugin_id uuid not null references public.plugins(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (plugin_id, tag_id)
);
grant select, insert, delete on public.plugin_tags to authenticated;
grant select on public.plugin_tags to anon;
grant all on public.plugin_tags to service_role;
alter table public.plugin_tags enable row level security;
create policy "plugin_tags_read" on public.plugin_tags for select using (public.plugin_is_public(plugin_id) or public.owns_plugin(plugin_id) or public.has_role(auth.uid(),'admin'));
create policy "plugin_tags_write" on public.plugin_tags for insert to authenticated with check (public.owns_plugin(plugin_id) or public.has_role(auth.uid(),'admin'));
create policy "plugin_tags_delete" on public.plugin_tags for delete to authenticated using (public.owns_plugin(plugin_id) or public.has_role(auth.uid(),'admin'));

create table public.plugin_assets (
  id uuid primary key default gen_random_uuid(),
  plugin_id uuid not null references public.plugins(id) on delete cascade,
  asset_type public.asset_type not null default 'screenshot',
  storage_path text not null,
  public_url text,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index plugin_assets_plugin_idx on public.plugin_assets(plugin_id);
grant select, insert, update, delete on public.plugin_assets to authenticated;
grant select on public.plugin_assets to anon;
grant all on public.plugin_assets to service_role;
alter table public.plugin_assets enable row level security;
create policy "plugin_assets_read" on public.plugin_assets for select using (public.plugin_is_public(plugin_id) or public.owns_plugin(plugin_id) or public.has_role(auth.uid(),'admin'));
create policy "plugin_assets_write" on public.plugin_assets for all to authenticated using (public.owns_plugin(plugin_id) or public.has_role(auth.uid(),'admin')) with check (public.owns_plugin(plugin_id) or public.has_role(auth.uid(),'admin'));

create table public.plugin_versions (
  id uuid primary key default gen_random_uuid(),
  plugin_id uuid not null references public.plugins(id) on delete cascade,
  version_number text not null,
  changelog text,
  release_notes text,
  compatibility text,
  file_path text,
  file_size bigint,
  is_current boolean not null default false,
  status public.version_status not null default 'draft',
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plugin_id, version_number)
);
create index plugin_versions_plugin_idx on public.plugin_versions(plugin_id);
grant select, insert, update, delete on public.plugin_versions to authenticated;
grant select on public.plugin_versions to anon;
grant all on public.plugin_versions to service_role;
alter table public.plugin_versions enable row level security;
create policy "plugin_versions_read" on public.plugin_versions for select using ((status = 'published' and public.plugin_is_public(plugin_id)) or public.owns_plugin(plugin_id) or public.has_role(auth.uid(),'admin'));
create policy "plugin_versions_write" on public.plugin_versions for all to authenticated using (public.owns_plugin(plugin_id) or public.has_role(auth.uid(),'admin')) with check (public.owns_plugin(plugin_id) or public.has_role(auth.uid(),'admin'));
create trigger plugin_versions_updated_at before update on public.plugin_versions for each row execute function public.update_updated_at_column();

create table public.plugin_change_requests (
  id uuid primary key default gen_random_uuid(),
  plugin_id uuid not null references public.plugins(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  changed_fields jsonb not null default '{}'::jsonb,
  status public.change_request_status not null default 'pending',
  admin_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
grant select, insert on public.plugin_change_requests to authenticated;
grant all on public.plugin_change_requests to service_role;
alter table public.plugin_change_requests enable row level security;
create policy "pcr_read" on public.plugin_change_requests for select to authenticated using (public.owns_plugin(plugin_id) or public.has_role(auth.uid(),'admin'));
create policy "pcr_insert" on public.plugin_change_requests for insert to authenticated with check (public.owns_plugin(plugin_id));
create policy "pcr_admin_update" on public.plugin_change_requests for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- =============== COMMERCE ===============
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plugin_id uuid not null references public.plugins(id) on delete restrict,
  developer_id uuid references public.developer_profiles(id) on delete set null,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  amount numeric(10,2) not null default 0 check (amount >= 0),
  currency text not null default 'USD',
  status public.purchase_status not null default 'pending',
  purchased_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index purchases_user_idx on public.purchases(user_id);
create index purchases_plugin_idx on public.purchases(plugin_id);
create unique index purchases_unique_paid on public.purchases(user_id, plugin_id) where status = 'paid';
grant select on public.purchases to authenticated;
grant all on public.purchases to service_role;
alter table public.purchases enable row level security;
create policy "purchases_read" on public.purchases for select to authenticated using (user_id = auth.uid() or public.owns_developer(developer_id) or public.has_role(auth.uid(),'admin'));
create trigger purchases_updated_at before update on public.purchases for each row execute function public.update_updated_at_column();

create or replace function public.has_purchased(_user_id uuid, _plugin_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.purchases p where p.user_id = _user_id and p.plugin_id = _plugin_id and p.status = 'paid')
$$;

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid references public.purchases(id) on delete set null,
  developer_id uuid references public.developer_profiles(id) on delete set null,
  type public.transaction_type not null,
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  description text,
  stripe_reference text,
  created_at timestamptz not null default now()
);
create index transactions_developer_idx on public.transactions(developer_id);
grant select on public.transactions to authenticated;
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
create policy "transactions_read" on public.transactions for select to authenticated using (public.owns_developer(developer_id) or public.has_role(auth.uid(),'admin'));

create table public.developer_balances (
  developer_id uuid primary key references public.developer_profiles(id) on delete cascade,
  currency text not null default 'USD',
  gross_revenue numeric(12,2) not null default 0,
  platform_fees numeric(12,2) not null default 0,
  refunds numeric(12,2) not null default 0,
  pending_balance numeric(12,2) not null default 0,
  available_balance numeric(12,2) not null default 0,
  paid_out numeric(12,2) not null default 0,
  updated_at timestamptz not null default now()
);
grant select on public.developer_balances to authenticated;
grant all on public.developer_balances to service_role;
alter table public.developer_balances enable row level security;
create policy "balances_read" on public.developer_balances for select to authenticated using (public.owns_developer(developer_id) or public.has_role(auth.uid(),'admin'));
create trigger developer_balances_updated_at before update on public.developer_balances for each row execute function public.update_updated_at_column();

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.developer_profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'USD',
  status public.payout_status not null default 'requested',
  stripe_payout_id text,
  notes text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payouts_developer_idx on public.payouts(developer_id);
grant select on public.payouts to authenticated;
grant all on public.payouts to service_role;
alter table public.payouts enable row level security;
create policy "payouts_read" on public.payouts for select to authenticated using (public.owns_developer(developer_id) or public.has_role(auth.uid(),'admin'));
create trigger payouts_updated_at before update on public.payouts for each row execute function public.update_updated_at_column();

-- =============== REVIEWS ===============
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  plugin_id uuid not null references public.plugins(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  title text,
  body text,
  verified_purchase boolean not null default false,
  status public.review_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plugin_id, user_id)
);
create index reviews_plugin_idx on public.reviews(plugin_id);
grant select, insert, update on public.reviews to authenticated;
grant select on public.reviews to anon;
grant all on public.reviews to service_role;
alter table public.reviews enable row level security;
create policy "reviews_read" on public.reviews for select using (status = 'active' or user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "reviews_insert" on public.reviews for insert to authenticated with check (user_id = auth.uid() and public.has_purchased(auth.uid(), plugin_id));
create policy "reviews_update" on public.reviews for update to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin')) with check (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create trigger reviews_updated_at before update on public.reviews for each row execute function public.update_updated_at_column();

create or replace function public.recalc_plugin_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  pid := coalesce(new.plugin_id, old.plugin_id);
  update public.plugins p set
    rating_average = coalesce((select round(avg(r.rating)::numeric,2) from public.reviews r where r.plugin_id = pid and r.status = 'active'),0),
    reviews_count = (select count(*) from public.reviews r where r.plugin_id = pid and r.status = 'active')
  where p.id = pid;
  return null;
end; $$;
create trigger reviews_recalc after insert or update or delete on public.reviews for each row execute function public.recalc_plugin_rating();

-- =============== FAVORITES / WISHLIST / COLLECTIONS ===============
create table public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  plugin_id uuid not null references public.plugins(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, plugin_id)
);
grant select, insert, delete on public.favorites to authenticated;
grant all on public.favorites to service_role;
alter table public.favorites enable row level security;
create policy "favorites_own" on public.favorites for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.wishlists (
  user_id uuid not null references auth.users(id) on delete cascade,
  plugin_id uuid not null references public.plugins(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, plugin_id)
);
grant select, insert, delete on public.wishlists to authenticated;
grant all on public.wishlists to service_role;
alter table public.wishlists enable row level security;
create policy "wishlists_own" on public.wishlists for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.recalc_plugin_counters()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  pid := coalesce(new.plugin_id, old.plugin_id);
  update public.plugins p set
    favorites_count = (select count(*) from public.favorites f where f.plugin_id = pid),
    wishlist_count = (select count(*) from public.wishlists w where w.plugin_id = pid)
  where p.id = pid;
  return null;
end; $$;
create trigger favorites_counters after insert or delete on public.favorites for each row execute function public.recalc_plugin_counters();
create trigger wishlists_counters after insert or delete on public.wishlists for each row execute function public.recalc_plugin_counters();

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index collections_owner_idx on public.collections(owner_id);
grant select, insert, update, delete on public.collections to authenticated;
grant select on public.collections to anon;
grant all on public.collections to service_role;
alter table public.collections enable row level security;
create policy "collections_read" on public.collections for select using (is_public or owner_id = auth.uid());
create policy "collections_own_write" on public.collections for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create trigger collections_updated_at before update on public.collections for each row execute function public.update_updated_at_column();

create table public.collection_plugins (
  collection_id uuid not null references public.collections(id) on delete cascade,
  plugin_id uuid not null references public.plugins(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (collection_id, plugin_id)
);
grant select, insert, update, delete on public.collection_plugins to authenticated;
grant select on public.collection_plugins to anon;
grant all on public.collection_plugins to service_role;
alter table public.collection_plugins enable row level security;
create policy "collection_plugins_read" on public.collection_plugins for select using (exists (select 1 from public.collections c where c.id = collection_id and (c.is_public or c.owner_id = auth.uid())));
create policy "collection_plugins_write" on public.collection_plugins for all to authenticated using (exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = auth.uid())) with check (exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = auth.uid()));

-- =============== CLAIMS / REPORTS ===============
create table public.claims (
  id uuid primary key default gen_random_uuid(),
  plugin_id uuid not null references public.plugins(id) on delete cascade,
  claimant_user_id uuid not null references auth.users(id) on delete cascade,
  developer_profile_id uuid references public.developer_profiles(id) on delete set null,
  evidence text,
  proof_url text,
  message text,
  status public.claim_status not null default 'pending',
  admin_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index claims_plugin_idx on public.claims(plugin_id);
grant select, insert on public.claims to authenticated;
grant all on public.claims to service_role;
alter table public.claims enable row level security;
create policy "claims_read" on public.claims for select to authenticated using (claimant_user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "claims_insert" on public.claims for insert to authenticated with check (claimant_user_id = auth.uid());
create policy "claims_admin_update" on public.claims for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type public.report_target not null,
  plugin_id uuid references public.plugins(id) on delete cascade,
  review_id uuid references public.reviews(id) on delete cascade,
  reporter_user_id uuid references auth.users(id) on delete set null,
  reason text not null,
  details text,
  status public.report_status not null default 'open',
  admin_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
grant select, insert on public.reports to authenticated;
grant all on public.reports to service_role;
alter table public.reports enable row level security;
create policy "reports_read" on public.reports for select to authenticated using (reporter_user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "reports_insert" on public.reports for insert to authenticated with check (reporter_user_id = auth.uid());
create policy "reports_admin_update" on public.reports for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- =============== ANALYTICS ===============
create table public.plugin_analytics_events (
  id uuid primary key default gen_random_uuid(),
  plugin_id uuid not null references public.plugins(id) on delete cascade,
  developer_id uuid references public.developer_profiles(id) on delete set null,
  event_type public.analytics_event_type not null,
  session_hash text,
  referrer text,
  created_at timestamptz not null default now()
);
create index analytics_plugin_idx on public.plugin_analytics_events(plugin_id, created_at desc);
grant select on public.plugin_analytics_events to authenticated;
grant all on public.plugin_analytics_events to service_role;
alter table public.plugin_analytics_events enable row level security;
create policy "analytics_read" on public.plugin_analytics_events for select to authenticated using (public.owns_developer(developer_id) or public.has_role(auth.uid(),'admin'));

-- =============== SEED ===============
insert into public.platforms (name, slug, description, icon, sort_order) values
  ('WordPress','wordpress','Plugins for WordPress sites and WooCommerce stores','wordpress',1),
  ('Blender','blender','Add-ons for 3D modeling, sculpting and rendering','blender',2),
  ('Unity','unity','Editor tools and runtime packages for Unity','unity',3),
  ('Adobe','adobe','Extensions for Photoshop, Illustrator, After Effects and more','adobe',4),
  ('Figma','figma','Plugins and widgets for Figma and FigJam','figma',5),
  ('VS Code','vscode','Extensions for Visual Studio Code','vscode',6),
  ('Chrome','chrome','Browser extensions for Chrome and Chromium','chrome',7),
  ('Shopify','shopify','Apps and theme extensions for Shopify','shopify',8),
  ('Unreal Engine 5','unreal-engine-5','Plugins and assets for Unreal Engine 5','unreal',9),
  ('PrestaShop','prestashop','Modules for PrestaShop stores','prestashop',10);

insert into public.categories (name, slug, description, icon, sort_order) values
  ('SEO','seo','Search engine optimization tools','search',1),
  ('E-commerce','ecommerce','Selling, checkout and store tools','shopping-cart',2),
  ('Productivity','productivity','Speed up everyday workflows','zap',3),
  ('Design & UI','design-ui','Design systems, UI kits and visual tools','palette',4),
  ('3D & Modeling','3d-modeling','Modeling, sculpting and retopology','box',5),
  ('Animation','animation','Rigging, motion and animation tools','film',6),
  ('Rendering','rendering','Renderers, shaders and lighting','sun',7),
  ('Developer Tools','developer-tools','Linters, debuggers and code helpers','terminal',8),
  ('Security','security','Protection, hardening and monitoring','shield',9),
  ('Analytics','analytics','Tracking, reporting and dashboards','bar-chart',10),
  ('Marketing','marketing','Campaigns, email and automation','megaphone',11),
  ('Performance','performance','Caching, optimization and speed','gauge',12),
  ('Content','content','Editors, blocks and media management','file-text',13),
  ('Integrations','integrations','Connect external services and APIs','plug',14),
  ('AI & Automation','ai-automation','AI assistants and automated workflows','sparkles',15);