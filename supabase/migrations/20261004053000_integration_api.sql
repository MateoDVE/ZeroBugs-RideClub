-- Una factura externa no puede asignarse a dos clientes de la misma empresa.
create unique index purchases_external_operation_unique
  on public.purchases(company_id, operation_id)
  where operation_id like 'EXT:%';

create table public.external_customer_links (
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  external_id text not null check (char_length(btrim(external_id)) between 3 and 120),
  source text not null default 'api' check (char_length(btrim(source)) between 2 and 40),
  last_synced_at timestamptz not null default now(),
  primary key (company_id, external_id),
  unique (company_id, profile_id)
);

create table public.integration_logs (
  id bigint generated always as identity primary key,
  request_id uuid not null unique,
  company_id uuid references public.companies(id) on delete set null,
  endpoint text not null,
  method text not null check (method in ('GET', 'POST')),
  status_code integer not null check (status_code between 100 and 599),
  outcome text not null check (outcome in ('success', 'error')),
  external_reference text,
  created_at timestamptz not null default now()
);

create index external_customer_links_profile_idx
  on public.external_customer_links(profile_id);
create index integration_logs_company_idx
  on public.integration_logs(company_id, created_at desc);

alter table public.external_customer_links enable row level security;
alter table public.integration_logs enable row level security;

create policy external_customer_links_scoped_read on public.external_customer_links
for select to authenticated
using (private.is_admin() or private.has_company_access(company_id));

create policy integration_logs_scoped_read on public.integration_logs
for select to authenticated
using (private.is_admin() or (company_id is not null and private.has_company_access(company_id)));

revoke all on public.external_customer_links, public.integration_logs from anon, authenticated;
grant select on public.external_customer_links, public.integration_logs to authenticated;

create or replace function public.record_external_purchase(
  p_company_slug text,
  p_customer_email text,
  p_external_id text,
  p_bike_id uuid,
  p_amount_usdt numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  company public.companies;
  customer public.profiles;
  item public.bikes;
  purchase_rule public.point_rules;
  referral_rule public.point_rules;
  existing public.purchases;
  created public.purchases;
  operation text;
  amount numeric(18,2);
begin
  if p_external_id is null or char_length(btrim(p_external_id)) not between 3 and 80 then
    raise exception 'La referencia externa debe tener entre 3 y 80 caracteres.';
  end if;

  select * into company
  from public.companies
  where slug = lower(btrim(p_company_slug)) and status = 'active';
  if company.id is null then raise exception 'La empresa no existe o no está activa.'; end if;

  select * into customer
  from public.profiles
  where lower(email) = lower(btrim(p_customer_email)) and role = 'client' and status = 'active';
  if customer.id is null then raise exception 'El cliente no existe o no está activo.'; end if;
  if customer.primary_company_id is distinct from company.id and not exists (
    select 1 from public.external_customer_links
    where company_id = company.id and profile_id = customer.id
  ) then
    raise exception 'El cliente no está vinculado con esta empresa.';
  end if;

  select * into item
  from public.bikes
  where id = p_bike_id and company_id = company.id and not archived;
  if item.id is null then raise exception 'La moto no pertenece al catálogo activo de la empresa.'; end if;

  amount := coalesce(p_amount_usdt, item.price_usdt);
  if amount is null or amount <= 0 then raise exception 'El monto de la compra no es válido.'; end if;

  operation := 'EXT:' || company.slug || ':' || btrim(p_external_id);
  if char_length(operation) > 100 then raise exception 'La referencia externa es demasiado larga.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(company.id::text || ':' || operation, 0)
  );

  select * into existing from public.purchases
  where company_id = company.id and operation_id = operation;
  if existing.id is not null then
    if existing.owner_id <> customer.id or existing.bike_id <> item.id or existing.amount_usdt <> amount then
      raise exception 'La referencia externa ya pertenece a otra compra.';
    end if;
    return jsonb_build_object('purchase', to_jsonb(existing), 'created', false);
  end if;

  select * into purchase_rule from public.point_rules
  where company_id = company.id and kind = 'purchase';
  if purchase_rule.company_id is null then raise exception 'La empresa no configuró puntos de compra.'; end if;

  insert into public.purchases(
    operation_id, owner_id, bike_id, company_id, bike_name, amount_usdt, points_awarded
  ) values (
    operation, customer.id, item.id, company.id, item.name, amount, purchase_rule.points
  ) returning * into created;

  if purchase_rule.points > 0 then
    insert into public.point_ledger(
      profile_id, company_id, kind, entry_type, amount, label, reference, metadata, expires_at
    ) values (
      customer.id, company.id, 'purchase', 'earn', purchase_rule.points,
      'Compra externa: ' || company.name || ' ' || item.name, created.id::text,
      jsonb_build_object('external_id', btrim(p_external_id), 'source', 'integration-api'),
      now() + make_interval(days => purchase_rule.expiry_days)
    );
  end if;

  select * into referral_rule from public.point_rules
  where company_id = company.id and kind = 'referral';
  if customer.referred_by_profile_id is not null
    and coalesce(referral_rule.points, 0) > 0
    and not exists (
      select 1 from public.point_ledger
      where kind = 'referral'
        and metadata ->> 'invited_profile_id' = customer.id::text
        and amount > 0
    ) then
    insert into public.point_ledger(
      profile_id, company_id, kind, entry_type, amount, label, reference, metadata, expires_at
    ) values (
      customer.referred_by_profile_id, company.id, 'referral', 'earn', referral_rule.points,
      'Referido confirmado', created.id::text,
      jsonb_build_object('invited_profile_id', customer.id, 'source', 'integration-api'),
      now() + make_interval(days => referral_rule.expiry_days)
    );
  end if;

  insert into public.audit_logs(actor_id, company_id, action, target_type, target_id, payload)
  values (
    null, company.id, 'Compra externa registrada', 'purchase', created.id::text,
    jsonb_build_object('external_id', btrim(p_external_id), 'source', 'integration-api')
  );

  return jsonb_build_object('purchase', to_jsonb(created), 'created', true);
end;
$$;

revoke all on function public.record_external_purchase(text, text, text, uuid, numeric)
  from public, anon, authenticated;
grant execute on function public.record_external_purchase(text, text, text, uuid, numeric)
  to service_role;
