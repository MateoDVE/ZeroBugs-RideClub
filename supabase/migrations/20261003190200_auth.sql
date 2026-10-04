create or replace function private.generate_referral_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return lpad(nextval('private.referral_code_seq'::regclass)::text, 8, '0');
end;
$$;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_company uuid;
  inviter uuid;
  requested_brand text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'brand', '')), '');
  referral text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'referral_code', '')), '');
  display_name text := btrim(coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  phone_value text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '');
begin
  if char_length(display_name) < 2 then display_name := 'Rider RideClub'; end if;
  if char_length(display_name) > 80 then raise exception 'El nombre es demasiado largo.'; end if;
  if phone_value is not null and phone_value !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'El celular no es válido.';
  end if;
  if requested_brand is not null then
    select c.id into selected_company
    from public.companies c
    where lower(c.name::text) = lower(requested_brand) and c.status = 'active';
    if selected_company is null then raise exception 'La empresa seleccionada no está disponible.'; end if;
  end if;
  if referral is not null then
    select p.id into inviter from public.profiles p where p.referral_code = referral and p.status = 'active';
    if inviter is null then raise exception 'El número de referido no existe.'; end if;
  end if;
  insert into public.profiles(
    id, full_name, email, phone, role, status, primary_company_id,
    referral_code, referred_by_profile_id
  ) values (
    new.id, display_name, lower(new.email), phone_value, 'client', 'active', selected_company,
    private.generate_referral_code(), inviter
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

revoke all on function private.generate_referral_code() from public, anon, authenticated;
revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

create or replace function public.account_access_status()
returns table(role public.app_role, status public.account_status, company_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.role,
    case
      when p.role = 'company' and not exists (
        select 1
        from public.company_memberships m
        join public.companies c on c.id = m.company_id
        where m.profile_id = p.id and m.active and c.status <> 'suspended'
      ) then 'blocked'::public.account_status
      else p.status
    end,
    p.primary_company_id
  from public.profiles p
  where p.id = (select auth.uid());
$$;

revoke all on function public.account_access_status() from public;
grant execute on function public.account_access_status() to authenticated;

create or replace function public.update_my_profile(
  p_full_name text,
  p_phone text,
  p_company_id uuid default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare result public.profiles;
begin
  result := private.assert_active_user();
  if char_length(btrim(p_full_name)) not between 2 and 80 then raise exception 'Revisa tu nombre.'; end if;
  if p_phone is not null and p_phone !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'Revisa el celular.'; end if;
  if p_company_id is not null and not exists (
    select 1 from public.companies where id = p_company_id and status = 'active'
  ) then raise exception 'La empresa no está disponible.'; end if;
  if p_company_id is not null and result.role <> 'client' then
    raise exception 'Solo un cliente puede cambiar su empresa vinculada.';
  end if;
  update public.profiles
  set full_name = btrim(p_full_name), phone = p_phone, primary_company_id = coalesce(p_company_id, primary_company_id)
  where id = (select auth.uid())
  returning * into result;
  return result;
end;
$$;

revoke all on function public.update_my_profile(text, text, uuid) from public;
grant execute on function public.update_my_profile(text, text, uuid) to authenticated;

create or replace function public.my_referrals()
returns table(
  id uuid,
  full_name text,
  primary_company_id uuid,
  created_at timestamptz,
  rewarded boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    invited.id,
    invited.full_name,
    invited.primary_company_id,
    invited.created_at,
    exists (
      select 1
      from public.point_ledger ledger
      where ledger.kind = 'referral'
        and ledger.amount > 0
        and ledger.metadata ->> 'invited_profile_id' = invited.id::text
    )
  from public.profiles invited
  where private.is_active_user()
    and invited.referred_by_profile_id = (select auth.uid())
  order by invited.created_at desc;
$$;

revoke all on function public.my_referrals() from public;
grant execute on function public.my_referrals() to authenticated;
