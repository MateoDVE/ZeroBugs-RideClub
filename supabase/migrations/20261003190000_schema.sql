create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create sequence private.referral_code_seq
  as bigint minvalue 10000000 maxvalue 99999999 start with 10000000 no cycle;

create type public.app_role as enum ('client', 'company', 'admin');
create type public.account_status as enum ('active', 'blocked', 'deleted');
create type public.company_status as enum ('pending', 'active', 'suspended');
create type public.activity_kind as enum ('purchase', 'maintenance', 'referral', 'event');
create type public.reward_kind as enum ('service', 'parts', 'care');
create type public.ledger_type as enum ('earn', 'redeem', 'expire', 'adjustment');

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  access_email text not null,
  subtitle text not null default 'Tu próxima ruta empieza aquí',
  logo_url text not null default '',
  color text not null default '#c6f46a' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  website_url text not null default '',
  status public.company_status not null default 'pending',
  wallet_address text,
  wallet_chain_id integer not null default 84532,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (website_url = '' or website_url ~* '^https?://'),
  check (
    logo_url = '' or logo_url ~* '^https?://' or logo_url ~ '^/assets/[A-Za-z0-9._/-]+$'
    or logo_url ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$'
  )
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 80),
  email text not null,
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  role public.app_role not null default 'client',
  status public.account_status not null default 'active',
  primary_company_id uuid references public.companies(id) on delete set null,
  referral_code text not null unique check (referral_code ~ '^[0-9]{8}$'),
  referred_by_profile_id uuid references public.profiles(id) on delete set null,
  demo_usdt numeric(18,2) not null default 20000 check (demo_usdt >= 0),
  wallet_status text not null default 'pending' check (wallet_status in ('pending', 'ready', 'disabled')),
  wallet_chain_id integer not null default 84532,
  wallet_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_memberships (
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Administrador de empresa',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (company_id, profile_id)
);

create table public.point_rules (
  company_id uuid not null references public.companies(id) on delete cascade,
  kind public.activity_kind not null,
  points integer not null check (points between 0 and 1000000),
  expiry_days integer not null default 365 check (expiry_days between 1 and 3650),
  updated_at timestamptz not null default now(),
  primary key (company_id, kind)
);

create table public.bikes (
  id uuid primary key default gen_random_uuid(),
  external_key text unique,
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  category text not null,
  tag text not null,
  description text not null,
  image_url text not null default '/assets/motorcycle-placeholder.svg',
  price_usdt numeric(18,2) check (price_usdt is null or price_usdt > 0),
  source_url text not null default '',
  region text not null default 'Catálogo de empresa',
  specs jsonb not null default '[]'::jsonb check (jsonb_typeof(specs) = 'array'),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_url = '' or source_url ~* '^https?://'),
  check (
    image_url ~* '^https?://' or image_url ~ '^/assets/[A-Za-z0-9._/-]+$'
    or image_url ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$'
  )
);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  external_key text unique,
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 100),
  kind public.reward_kind not null,
  category text not null,
  points integer not null check (points between 1 and 1000000),
  detail text not null,
  terms text not null,
  validity_days integer not null check (validity_days between 1 and 3650),
  stock integer not null check (stock between 0 and 10000),
  image_url text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    image_url is null or image_url ~* '^https?://' or image_url ~ '^/assets/[A-Za-z0-9._/-]+$'
    or image_url ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$'
  )
);

create table public.point_balances (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now(),
  primary key (profile_id, company_id)
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  operation_id text not null,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  bike_id uuid not null references public.bikes(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete restrict,
  bike_name text not null,
  amount_usdt numeric(18,2) not null check (amount_usdt > 0),
  points_awarded integer not null check (points_awarded >= 0),
  created_at timestamptz not null default now(),
  unique (owner_id, operation_id)
);

create table public.point_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete restrict,
  kind public.activity_kind,
  entry_type public.ledger_type not null,
  amount integer not null check (amount <> 0),
  label text not null,
  reference text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  expires_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index point_ledger_reference_unique
  on public.point_ledger(company_id, reference, kind)
  where reference is not null and kind is not null and amount > 0;
create unique index point_ledger_referral_invitee_unique
  on public.point_ledger((metadata ->> 'invited_profile_id'))
  where kind = 'referral' and amount > 0 and metadata ? 'invited_profile_id';

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  reward_id uuid not null references public.rewards(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete restrict,
  title text not null,
  points_spent integer not null check (points_spent > 0),
  terms text not null,
  image_url text,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  workshop text,
  used_by uuid references public.profiles(id) on delete set null,
  check (used_at is null or workshop is not null)
);

create table public.favorites (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  bike_id uuid not null references public.bikes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, bike_id)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index profiles_company_idx on public.profiles(primary_company_id);
create unique index companies_name_unique on public.companies(lower(name));
create unique index companies_access_email_unique on public.companies(lower(access_email));
create unique index profiles_email_unique on public.profiles(lower(email));
create index memberships_profile_idx on public.company_memberships(profile_id) where active;
create index bikes_company_idx on public.bikes(company_id) where not archived;
create index rewards_company_idx on public.rewards(company_id) where not archived;
create index purchases_owner_idx on public.purchases(owner_id, created_at desc);
create index purchases_company_idx on public.purchases(company_id, created_at desc);
create index ledger_profile_idx on public.point_ledger(profile_id, created_at desc);
create index ledger_company_idx on public.point_ledger(company_id, created_at desc);
create index ledger_expiry_idx on public.point_ledger(expires_at) where expired_at is null and amount > 0;
create index coupons_owner_idx on public.coupons(owner_id, issued_at desc);
create index coupons_company_idx on public.coupons(company_id, issued_at desc);
create index audit_company_idx on public.audit_logs(company_id, created_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger companies_updated_at before update on public.companies
for each row execute function private.set_updated_at();
create trigger profiles_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger bikes_updated_at before update on public.bikes
for each row execute function private.set_updated_at();
create trigger rewards_updated_at before update on public.rewards
for each row execute function private.set_updated_at();

create or replace function private.apply_ledger_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_balance integer;
begin
  insert into public.point_balances(profile_id, company_id, balance)
  values (new.profile_id, new.company_id, new.amount)
  on conflict (profile_id, company_id)
  do update set balance = public.point_balances.balance + excluded.balance,
                updated_at = now()
  returning balance into next_balance;

  if next_balance < 0 then
    raise exception 'Saldo de puntos insuficiente.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger point_ledger_balance
after insert on public.point_ledger
for each row execute function private.apply_ledger_balance();
