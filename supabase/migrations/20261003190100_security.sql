create or replace function private.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid()) and p.status = 'active';
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_role() = 'admin', false);
$$;

create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status = 'active'
  );
$$;

create or replace function private.has_company_access(target_company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin() or exists (
    select 1
    from public.company_memberships m
    join public.profiles p on p.id = m.profile_id
    join public.companies c on c.id = m.company_id
    where m.profile_id = (select auth.uid())
      and m.company_id = target_company
      and m.active
      and p.role = 'company'
      and p.status = 'active'
      and c.status <> 'suspended'
  );
$$;

create or replace function private.can_view_profile(target_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (target_profile = (select auth.uid()) and private.is_active_user())
    or private.is_admin()
    or exists (
      select 1
      from public.company_memberships m
      where m.profile_id = (select auth.uid())
        and m.active
        and private.has_company_access(m.company_id)
        and (
          exists (select 1 from public.profiles p where p.id = target_profile and p.primary_company_id = m.company_id)
          or exists (select 1 from public.purchases x where x.owner_id = target_profile and x.company_id = m.company_id)
          or exists (select 1 from public.coupons x where x.owner_id = target_profile and x.company_id = m.company_id)
          or exists (select 1 from public.point_ledger x where x.profile_id = target_profile and x.company_id = m.company_id)
        )
    );
$$;

create or replace function private.assert_active_user()
returns public.profiles
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result public.profiles;
begin
  select * into result from public.profiles where id = (select auth.uid());
  if result.id is null then raise exception 'Perfil no encontrado.' using errcode = 'P0001'; end if;
  if result.status = 'blocked' then raise exception 'Esta cuenta está bloqueada.' using errcode = 'P0001'; end if;
  if result.status = 'deleted' then raise exception 'Esta cuenta fue dada de baja.' using errcode = 'P0001'; end if;
  return result;
end;
$$;

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.company_memberships enable row level security;
alter table public.point_rules enable row level security;
alter table public.bikes enable row level security;
alter table public.rewards enable row level security;
alter table public.point_balances enable row level security;
alter table public.purchases enable row level security;
alter table public.point_ledger enable row level security;
alter table public.coupons enable row level security;
alter table public.favorites enable row level security;
alter table public.audit_logs enable row level security;

create policy companies_public_read on public.companies
for select to anon, authenticated
using (status = 'active' or private.has_company_access(id));

create policy profiles_scoped_read on public.profiles
for select to authenticated
using (private.can_view_profile(id));

create policy memberships_scoped_read on public.company_memberships
for select to authenticated
using ((profile_id = (select auth.uid()) and private.is_active_user()) or private.has_company_access(company_id));

create policy point_rules_public_read on public.point_rules
for select to anon, authenticated
using (
  exists (select 1 from public.companies c where c.id = company_id and c.status = 'active')
  or private.has_company_access(company_id)
);

create policy bikes_public_read on public.bikes
for select to anon, authenticated
using (
  (not archived and exists (select 1 from public.companies c where c.id = company_id and c.status = 'active'))
  or private.has_company_access(company_id)
);

create policy rewards_public_read on public.rewards
for select to anon, authenticated
using (
  (not archived and exists (select 1 from public.companies c where c.id = company_id and c.status = 'active'))
  or private.has_company_access(company_id)
);

create policy balances_scoped_read on public.point_balances
for select to authenticated
using (
  (profile_id = (select auth.uid()) and private.is_active_user())
  or private.has_company_access(company_id)
);

create policy purchases_scoped_read on public.purchases
for select to authenticated
using ((owner_id = (select auth.uid()) and private.is_active_user()) or private.has_company_access(company_id));

create policy ledger_scoped_read on public.point_ledger
for select to authenticated
using ((profile_id = (select auth.uid()) and private.is_active_user()) or private.has_company_access(company_id));

create policy coupons_scoped_read on public.coupons
for select to authenticated
using ((owner_id = (select auth.uid()) and private.is_active_user()) or private.has_company_access(company_id));

create policy favorites_own_read on public.favorites
for select to authenticated
using (profile_id = (select auth.uid()) and private.is_active_user());
create policy favorites_own_insert on public.favorites
for insert to authenticated
with check (profile_id = (select auth.uid()) and private.is_active_user());
create policy favorites_own_delete on public.favorites
for delete to authenticated
using (profile_id = (select auth.uid()) and private.is_active_user());

create policy audit_scoped_read on public.audit_logs
for select to authenticated
using (private.is_admin() or (company_id is not null and private.has_company_access(company_id)));

revoke all on all tables in schema public from anon, authenticated;
grant select on public.companies, public.point_rules, public.bikes, public.rewards to anon, authenticated;
grant select on public.profiles, public.company_memberships, public.point_balances,
  public.purchases, public.point_ledger, public.coupons, public.audit_logs to authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant usage on all sequences in schema public to authenticated;
grant usage on schema private to anon, authenticated;
revoke all on function private.current_role() from public, anon, authenticated;
revoke all on function private.is_admin() from public, anon, authenticated;
revoke all on function private.is_active_user() from public, anon, authenticated;
revoke all on function private.has_company_access(uuid) from public, anon, authenticated;
revoke all on function private.can_view_profile(uuid) from public, anon, authenticated;
revoke all on function private.assert_active_user() from public, anon, authenticated;
revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.apply_ledger_balance() from public, anon, authenticated;
grant execute on function private.current_role() to anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;
grant execute on function private.is_active_user() to anon, authenticated;
grant execute on function private.has_company_access(uuid) to anon, authenticated;
grant execute on function private.can_view_profile(uuid) to authenticated;
