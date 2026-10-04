-- Validate ledger deductions before touching the constrained balance row.
-- This keeps concurrent or repeated redemption attempts atomic and returns a
-- useful domain error instead of leaking a PostgreSQL check-constraint error.
create or replace function private.apply_ledger_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_balance integer;
  next_balance integer;
begin
  select balance
  into current_balance
  from public.point_balances
  where profile_id = new.profile_id and company_id = new.company_id
  for update;

  if not found then
    if new.amount < 0 then
      raise exception 'Saldo de puntos insuficiente.' using errcode = 'P0001';
    end if;
    insert into public.point_balances(profile_id, company_id, balance)
    values (new.profile_id, new.company_id, new.amount);
    return new;
  end if;

  next_balance := current_balance + new.amount;
  if next_balance < 0 then
    raise exception 'Saldo de puntos insuficiente.' using errcode = 'P0001';
  end if;

  update public.point_balances
  set balance = next_balance, updated_at = now()
  where profile_id = new.profile_id and company_id = new.company_id;
  return new;
end;
$$;

revoke all on function private.apply_ledger_balance() from public, anon, authenticated;
