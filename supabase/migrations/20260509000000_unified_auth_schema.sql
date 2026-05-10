-- Unified auth + user/admin schema
-- Replaces the custom JWT systems from ContentForgeHomePage and ContentForgeUniTolAdmin
-- with Supabase Auth as the single source of truth.

-- ============================================================================
-- 1. profiles
-- ============================================================================
-- One row per auth.users row. Created automatically by trigger on signup.
-- Holds the merged shape of HP `users` and AD `cf_users`.

create table if not exists public.profiles (
  id                  uuid        primary key references auth.users(id) on delete cascade,
  email               text        not null unique,
  full_name           text,
  phone               text,
  account_type        text        not null default 'individual'
                                  check (account_type in ('individual', 'organization')),
  organization_name   text,
  role                text        not null default 'user'
                                  check (role in ('user', 'admin')),
  credits_total       integer     not null default 0,
  credits_used        integer     not null default 0,
  plan                text        not null default 'free',
  status              text        not null default 'active',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role);

-- ============================================================================
-- 2. billing_transactions
-- ============================================================================
create table if not exists public.billing_transactions (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        not null references public.profiles(id) on delete cascade,
  razorpay_order_id    text,
  razorpay_payment_id  text,
  amount_inr           integer     not null,  -- in paise
  credits_purchased    integer     not null,
  status               text        not null default 'created'
                                   check (status in ('created', 'paid', 'failed')),
  created_at           timestamptz not null default now()
);

create index if not exists billing_transactions_user_id_idx on public.billing_transactions(user_id);
create index if not exists billing_transactions_razorpay_order_id_idx on public.billing_transactions(razorpay_order_id);

-- ============================================================================
-- 3. provider_configs
-- ============================================================================
create table if not exists public.provider_configs (
  id                 uuid        primary key default gen_random_uuid(),
  provider_name      text        not null,
  api_key_encrypted  text        not null,
  is_active          boolean     not null default true,
  config_json        jsonb,
  updated_by         uuid        references public.profiles(id) on delete set null,
  updated_at         timestamptz not null default now()
);

create index if not exists provider_configs_provider_name_idx on public.provider_configs(provider_name);

-- ============================================================================
-- 4. conversations
-- ============================================================================
create table if not exists public.conversations (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  subject     text        not null,
  status      text        not null default 'open'
                          check (status in ('open', 'resolved')),
  created_at  timestamptz not null default now()
);

create index if not exists conversations_user_id_idx on public.conversations(user_id);
create index if not exists conversations_status_idx on public.conversations(status);

-- ============================================================================
-- Helpers
-- ============================================================================

-- security-definer admin check. Bypasses RLS so policies on `profiles` can
-- reference role without recursing through their own SELECT policy.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = uid and role = 'admin'
  );
$$;

-- updated_at touch trigger
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- auto-create profile on auth.users insert. Reads metadata supplied via
-- supabase.auth.signUp({ options: { data: { full_name, account_type, organization_name } } })
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, account_type, organization_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'account_type', 'individual'),
    new.raw_user_meta_data->>'organization_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.profiles              enable row level security;
alter table public.billing_transactions  enable row level security;
alter table public.provider_configs      enable row level security;
alter table public.conversations         enable row level security;

-- profiles: user reads/updates own; admin reads all
drop policy if exists profiles_select_self  on public.profiles;
drop policy if exists profiles_select_admin on public.profiles;
drop policy if exists profiles_update_self  on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;

create policy profiles_select_self on public.profiles
  for select using (auth.uid() = id);

create policy profiles_select_admin on public.profiles
  for select using (public.is_admin(auth.uid()));

create policy profiles_update_self on public.profiles
  for update using (auth.uid() = id)
            with check (auth.uid() = id);

create policy profiles_update_admin on public.profiles
  for update using (public.is_admin(auth.uid()))
            with check (public.is_admin(auth.uid()));

-- billing_transactions: read-only for users (own) + admins (all). Writes are
-- service-role only — Razorpay flow runs server-side.
drop policy if exists billing_tx_select_own   on public.billing_transactions;
drop policy if exists billing_tx_select_admin on public.billing_transactions;

create policy billing_tx_select_own on public.billing_transactions
  for select using (auth.uid() = user_id);

create policy billing_tx_select_admin on public.billing_transactions
  for select using (public.is_admin(auth.uid()));

-- provider_configs: admins only, full CRUD
drop policy if exists provider_configs_admin_all on public.provider_configs;

create policy provider_configs_admin_all on public.provider_configs
  for all using (public.is_admin(auth.uid()))
          with check (public.is_admin(auth.uid()));

-- conversations: user reads/inserts own; admin reads all + updates (e.g. resolve)
drop policy if exists conversations_select_own   on public.conversations;
drop policy if exists conversations_select_admin on public.conversations;
drop policy if exists conversations_insert_own   on public.conversations;
drop policy if exists conversations_update_admin on public.conversations;

create policy conversations_select_own on public.conversations
  for select using (auth.uid() = user_id);

create policy conversations_select_admin on public.conversations
  for select using (public.is_admin(auth.uid()));

create policy conversations_insert_own on public.conversations
  for insert with check (auth.uid() = user_id);

create policy conversations_update_admin on public.conversations
  for update using (public.is_admin(auth.uid()))
            with check (public.is_admin(auth.uid()));
