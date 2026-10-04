-- Expire points every day even when customers do not open the application.
create extension if not exists pg_cron with schema pg_catalog;

create or replace function private.expire_all_points()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
  expired_total integer := 0;
begin
  for target in
    select distinct ledger.profile_id
    from public.point_ledger ledger
    where ledger.amount > 0
      and ledger.expires_at <= now()
      and ledger.expired_at is null
  loop
    expired_total := expired_total + private.expire_points_for(target.profile_id);
  end loop;
  return expired_total;
end;
$$;

revoke all on function private.expire_all_points() from public, anon, authenticated;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'rideclub-expire-points';

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'rideclub-expire-points',
    '0 4 * * *',
    'select private.expire_all_points();'
  );
end
$$;
