-- Publish every user-visible table so authorized sessions receive changes
-- immediately. RLS remains the source of truth for which rows each role sees.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'companies',
    'profiles',
    'company_memberships',
    'point_rules',
    'bikes',
    'rewards',
    'point_balances',
    'purchases',
    'point_ledger',
    'coupons',
    'favorites',
    'audit_logs'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        table_name
      );
    end if;
  end loop;
end
$$;
