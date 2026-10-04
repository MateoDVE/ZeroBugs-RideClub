create or replace function public.purchase_bike(p_bike_id uuid, p_operation_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  buyer public.profiles;
  item public.bikes;
  company public.companies;
  purchase_rule public.point_rules;
  referral_rule public.point_rules;
  existing public.purchases;
  created public.purchases;
begin
  perform private.assert_active_user();
  if char_length(btrim(p_operation_id)) not between 8 and 100 then raise exception 'La operación no es válida.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended((select auth.uid())::text || ':' || btrim(p_operation_id), 0)
  );
  select * into existing from public.purchases
    where owner_id = (select auth.uid()) and operation_id = btrim(p_operation_id);
  if existing.id is not null then
    if existing.bike_id <> p_bike_id then raise exception 'La operación ya pertenece a otra compra.'; end if;
    return to_jsonb(existing);
  end if;

  select * into buyer from public.profiles where id = (select auth.uid()) for update;
  if buyer.role <> 'client' then raise exception 'Ingresa como cliente para comprar.'; end if;
  select * into item from public.bikes where id = p_bike_id and not archived;
  if item.id is null or item.price_usdt is null then raise exception 'Este modelo necesita una cotización.'; end if;
  select * into company from public.companies where id = item.company_id and status = 'active';
  if company.id is null then raise exception 'Esta empresa no está publicada.'; end if;
  if buyer.demo_usdt < item.price_usdt then raise exception 'Saldo USDT de prueba insuficiente.'; end if;
  select * into purchase_rule from public.point_rules where company_id = company.id and kind = 'purchase';
  select * into referral_rule from public.point_rules where company_id = company.id and kind = 'referral';
  if purchase_rule.company_id is null then raise exception 'La empresa no configuró puntos de compra.'; end if;

  update public.profiles set demo_usdt = demo_usdt - item.price_usdt where id = buyer.id;
  insert into public.purchases(operation_id, owner_id, bike_id, company_id, bike_name, amount_usdt, points_awarded)
  values (btrim(p_operation_id), buyer.id, item.id, company.id, item.name, item.price_usdt, purchase_rule.points)
  returning * into created;

  if purchase_rule.points > 0 then
    insert into public.point_ledger(profile_id, company_id, kind, entry_type, amount, label, reference, expires_at)
    values (
      buyer.id, company.id, 'purchase', 'earn', purchase_rule.points,
      'Compra: ' || company.name || ' ' || item.name, created.id::text,
      now() + make_interval(days => purchase_rule.expiry_days)
    );
  end if;

  if buyer.referred_by_profile_id is not null and referral_rule.points > 0 and not exists (
    select 1 from public.point_ledger
    where kind = 'referral' and metadata ->> 'invited_profile_id' = buyer.id::text and amount > 0
  ) then
    insert into public.point_ledger(profile_id, company_id, kind, entry_type, amount, label, reference, metadata, expires_at)
    values (
      buyer.referred_by_profile_id, company.id, 'referral', 'earn', referral_rule.points,
      'Referido confirmado', created.id::text,
      jsonb_build_object('invited_profile_id', buyer.id),
      now() + make_interval(days => referral_rule.expiry_days)
    );
  end if;
  return to_jsonb(created);
end;
$$;

create or replace function public.redeem_reward(p_reward_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer public.profiles;
  benefit public.rewards;
  company public.companies;
  current_balance integer;
  issued integer;
  created public.coupons;
  coupon_code text;
begin
  perform private.assert_active_user();
  select * into customer from public.profiles where id = (select auth.uid()) for update;
  if customer.role <> 'client' then raise exception 'Ingresa como cliente para canjear.'; end if;
  select * into benefit from public.rewards where id = p_reward_id and not archived for update;
  if benefit.id is null then raise exception 'Este beneficio no está disponible.'; end if;
  select * into company from public.companies where id = benefit.company_id and status = 'active';
  if company.id is null then raise exception 'Este beneficio no está disponible.'; end if;
  select coalesce((
    select balance from public.point_balances
    where profile_id = customer.id and company_id = company.id for update
  ), 0) into current_balance;
  if current_balance < benefit.points then raise exception 'Saldo de puntos insuficiente.'; end if;
  select count(*) into issued from public.coupons where reward_id = benefit.id;
  if issued >= benefit.stock then raise exception 'Este beneficio se agotó.'; end if;
  coupon_code := 'RC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20));
  insert into public.coupons(
    code, owner_id, reward_id, company_id, title, points_spent, terms, image_url, expires_at
  ) values (
    coupon_code, customer.id, benefit.id, company.id, benefit.title, benefit.points,
    benefit.terms, benefit.image_url, now() + make_interval(days => benefit.validity_days)
  ) returning * into created;
  insert into public.point_ledger(profile_id, company_id, entry_type, amount, label, reference, metadata)
  values (
    customer.id, company.id, 'redeem', -benefit.points, 'Canje: ' || benefit.title,
    created.code, jsonb_build_object('coupon_id', created.id, 'reward_id', benefit.id)
  );
  return to_jsonb(created);
end;
$$;

create or replace function public.credit_activity(
  p_client_id uuid,
  p_company_id uuid,
  p_kind public.activity_kind,
  p_reference text,
  p_confirmed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.profiles;
  recipient uuid;
  rule public.point_rules;
  created public.point_ledger;
begin
  perform private.assert_active_user();
  if not private.has_company_access(p_company_id) then raise exception 'No tienes acceso a esta empresa.'; end if;
  if p_kind = 'purchase' then raise exception 'Las compras se acreditan automáticamente.'; end if;
  if not p_confirmed or char_length(btrim(p_reference)) not between 3 and 120 then raise exception 'Confirma la actividad e introduce una referencia válida.'; end if;
  select * into target from public.profiles where id = p_client_id and role = 'client';
  if target.id is null then raise exception 'Cliente no encontrado.'; end if;
  if not private.is_admin() and not (
    target.primary_company_id = p_company_id
    or exists (select 1 from public.purchases where owner_id = target.id and company_id = p_company_id)
    or exists (select 1 from public.coupons where owner_id = target.id and company_id = p_company_id)
  ) then raise exception 'El cliente no pertenece al ámbito de tu empresa.'; end if;
  select * into rule from public.point_rules where company_id = p_company_id and kind = p_kind;
  if rule.company_id is null then raise exception 'La regla no está configurada.'; end if;
  if rule.points = 0 then raise exception 'Esta actividad está desactivada para la empresa.'; end if;
  recipient := case when p_kind = 'referral' then target.referred_by_profile_id else target.id end;
  if recipient is null then raise exception 'Este cliente no tiene un referido asociado.'; end if;
  if p_kind = 'referral' and exists (
    select 1 from public.point_ledger where kind = 'referral'
      and metadata ->> 'invited_profile_id' = target.id::text and amount > 0
  ) then raise exception 'Este referido ya recibió su recompensa.'; end if;
  insert into public.point_ledger(profile_id, company_id, kind, entry_type, amount, label, reference, metadata, expires_at)
  values (
    recipient, p_company_id, p_kind, 'earn', rule.points,
    case when p_kind = 'referral' then 'Referido confirmado' else initcap(p_kind::text) || ' confirmada' end,
    upper(btrim(p_reference)),
    case when p_kind = 'referral' then jsonb_build_object('invited_profile_id', target.id) else '{}'::jsonb end,
    now() + make_interval(days => rule.expiry_days)
  ) returning * into created;
  insert into public.audit_logs(actor_id, company_id, action, target_type, target_id, payload)
  values ((select auth.uid()), p_company_id, 'Actividad acreditada', 'point_ledger', created.id::text, to_jsonb(created));
  return to_jsonb(created);
end;
$$;

create or replace function public.use_coupon(
  p_code text,
  p_workshop text,
  p_customer_confirmed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare benefit public.coupons;
begin
  perform private.assert_active_user();
  select * into benefit from public.coupons where code = upper(btrim(p_code)) for update;
  if benefit.id is null then raise exception 'No se encontró el cupón.'; end if;
  if not private.has_company_access(benefit.company_id) then raise exception 'El cupón pertenece a otra empresa.'; end if;
  if benefit.used_at is not null then raise exception 'Este cupón ya fue utilizado.'; end if;
  if benefit.expires_at <= now() then raise exception 'Este cupón está vencido.'; end if;
  if not p_customer_confirmed then raise exception 'Confirma la autorización del cliente.'; end if;
  if char_length(btrim(p_workshop)) not between 2 and 120 then raise exception 'Indica el nombre del taller.'; end if;
  update public.coupons set used_at = now(), workshop = btrim(p_workshop), used_by = (select auth.uid())
  where id = benefit.id returning * into benefit;
  insert into public.audit_logs(actor_id, company_id, action, target_type, target_id)
  values ((select auth.uid()), benefit.company_id, 'Cupón utilizado', 'coupon', benefit.id::text);
  return to_jsonb(benefit);
end;
$$;

create or replace function public.fund_demo_account()
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare result numeric;
begin
  if (private.assert_active_user()).role <> 'client' then
    raise exception 'Solo una cuenta de cliente puede recibir saldo de prueba.';
  end if;
  update public.profiles set demo_usdt = demo_usdt + 20000 where id = (select auth.uid())
  returning demo_usdt into result;
  return result;
end;
$$;

create or replace function private.expire_points_for(target_profile uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare item record; available integer; deduction integer; total integer := 0;
begin
  for item in
    select * from public.point_ledger
    where profile_id = target_profile and amount > 0 and expires_at <= now() and expired_at is null
    order by expires_at, created_at for update
  loop
    select coalesce((
      select balance from public.point_balances
      where profile_id = item.profile_id and company_id = item.company_id for update
    ), 0) into available;
    deduction := least(available, item.amount);
    update public.point_ledger set expired_at = now() where id = item.id;
    if deduction > 0 then
      insert into public.point_ledger(profile_id, company_id, entry_type, amount, label, reference, metadata)
      values (item.profile_id, item.company_id, 'expire', -deduction, 'Vencimiento de puntos', 'EXP-' || item.id::text, jsonb_build_object('source_ledger_id', item.id));
      total := total + deduction;
    end if;
  end loop;
  return total;
end;
$$;

create or replace function public.expire_my_points()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_active_user();
  return private.expire_points_for((select auth.uid()));
end;
$$;

revoke all on function public.purchase_bike(uuid, text) from public;
revoke all on function public.redeem_reward(uuid) from public;
revoke all on function public.credit_activity(uuid, uuid, public.activity_kind, text, boolean) from public;
revoke all on function public.use_coupon(text, text, boolean) from public;
revoke all on function public.fund_demo_account() from public;
revoke all on function public.expire_my_points() from public;
revoke all on function private.expire_points_for(uuid) from public, anon, authenticated;
grant execute on function public.purchase_bike(uuid, text) to authenticated;
grant execute on function public.redeem_reward(uuid) to authenticated;
grant execute on function public.credit_activity(uuid, uuid, public.activity_kind, text, boolean) to authenticated;
grant execute on function public.use_coupon(text, text, boolean) to authenticated;
grant execute on function public.fund_demo_account() to authenticated;
grant execute on function public.expire_my_points() to authenticated;
