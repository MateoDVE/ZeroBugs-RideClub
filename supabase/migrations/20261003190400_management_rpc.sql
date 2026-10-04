create or replace function private.assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_active_user();
  if not private.is_admin() then raise exception 'Esta operación requiere administración global.'; end if;
end;
$$;

create or replace function public.manage_company(
  p_id uuid,
  p_name text,
  p_access_email text,
  p_subtitle text,
  p_logo_url text,
  p_color text,
  p_website_url text,
  p_status public.company_status
)
returns public.companies
language plpgsql
security definer
set search_path = ''
as $$
declare result public.companies; generated_slug text;
begin
  perform private.assert_admin();
  if char_length(btrim(p_name)) not between 2 and 45 then raise exception 'Revisa el nombre de la empresa.'; end if;
  if p_access_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Revisa el correo de acceso.'; end if;
  if p_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Revisa el color.'; end if;
  generated_slug := lower(regexp_replace(btrim(p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  generated_slug := trim(both '-' from generated_slug);
  if generated_slug = '' then generated_slug := 'empresa'; end if;
  if exists (select 1 from public.companies where slug = generated_slug) then
    generated_slug := generated_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  end if;
  if p_id is null then
    insert into public.companies(slug, name, access_email, subtitle, logo_url, color, website_url, status)
    values (generated_slug, btrim(p_name), lower(btrim(p_access_email)), btrim(p_subtitle), btrim(p_logo_url), p_color, btrim(p_website_url), p_status)
    returning * into result;
    insert into public.point_rules(company_id, kind, points, expiry_days) values
      (result.id, 'purchase', 1000, 365),
      (result.id, 'maintenance', 500, 365),
      (result.id, 'referral', 200, 365),
      (result.id, 'event', 50, 365);
  else
    update public.companies set
      access_email = lower(btrim(p_access_email)), subtitle = btrim(p_subtitle), logo_url = btrim(p_logo_url),
      color = p_color, website_url = btrim(p_website_url), status = p_status
    where id = p_id returning * into result;
    if result.id is null then raise exception 'La empresa no existe.'; end if;
    if lower(result.name::text) <> lower(btrim(p_name)) then raise exception 'El nombre de la empresa no puede cambiar.'; end if;
  end if;
  insert into public.audit_logs(actor_id, company_id, action, target_type, target_id, payload)
  values ((select auth.uid()), result.id, case when p_id is null then 'Empresa registrada' else 'Empresa actualizada' end, 'company', result.id::text, to_jsonb(result));
  return result;
end;
$$;

create or replace function public.update_point_rules(p_company_id uuid, p_rules jsonb)
returns setof public.point_rules
language plpgsql
security definer
set search_path = ''
as $$
declare kind_name public.activity_kind; item jsonb; maintenance_points integer;
begin
  perform private.assert_active_user();
  if not private.has_company_access(p_company_id) then raise exception 'No tienes acceso a esta empresa.'; end if;
  foreach kind_name in array enum_range(null::public.activity_kind) loop
    item := p_rules -> kind_name::text;
    if item is null then raise exception 'Falta la regla %.', kind_name; end if;
    if (item ->> 'points')::integer not between 0 and 1000000 then raise exception 'Puntos inválidos para %.', kind_name; end if;
    if (item ->> 'expiry_days')::integer not between 1 and 3650 then raise exception 'Vigencia inválida para %.', kind_name; end if;
    insert into public.point_rules(company_id, kind, points, expiry_days)
    values (p_company_id, kind_name, (item ->> 'points')::integer, (item ->> 'expiry_days')::integer)
    on conflict (company_id, kind) do update
      set points = excluded.points, expiry_days = excluded.expiry_days, updated_at = now();
  end loop;
  maintenance_points := (p_rules -> 'maintenance' ->> 'points')::integer;
  update public.rewards set points = maintenance_points
    where company_id = p_company_id and kind = 'service';
  insert into public.audit_logs(actor_id, company_id, action, target_type, target_id, payload)
  values ((select auth.uid()), p_company_id, 'Reglas de puntos actualizadas', 'point_rules', p_company_id::text, p_rules);
  return query select * from public.point_rules where company_id = p_company_id order by kind;
end;
$$;

create or replace function public.manage_bike(
  p_id uuid, p_company_id uuid, p_name text, p_category text, p_tag text,
  p_description text, p_image_url text, p_price_usdt numeric,
  p_source_url text, p_region text, p_specs jsonb
)
returns public.bikes
language plpgsql
security definer
set search_path = ''
as $$
declare result public.bikes;
begin
  perform private.assert_active_user();
  if not private.has_company_access(p_company_id) then raise exception 'No tienes acceso a esta empresa.'; end if;
  if p_price_usdt is not null and p_price_usdt <= 0 then raise exception 'El precio debe ser positivo.'; end if;
  if jsonb_typeof(p_specs) <> 'array' or jsonb_array_length(p_specs) > 12 then raise exception 'Revisa las especificaciones.'; end if;
  if p_id is null then
    insert into public.bikes(company_id, name, category, tag, description, image_url, price_usdt, source_url, region, specs)
    values (p_company_id, btrim(p_name), btrim(p_category), btrim(p_tag), btrim(p_description), btrim(p_image_url), p_price_usdt, btrim(p_source_url), btrim(p_region), p_specs)
    returning * into result;
  else
    update public.bikes set name=btrim(p_name), category=btrim(p_category), tag=btrim(p_tag), description=btrim(p_description),
      image_url=btrim(p_image_url), price_usdt=p_price_usdt, source_url=btrim(p_source_url), region=btrim(p_region), specs=p_specs
    where id=p_id and company_id=p_company_id returning * into result;
    if result.id is null then raise exception 'La moto no existe en esta empresa.'; end if;
  end if;
  insert into public.audit_logs(actor_id, company_id, action, target_type, target_id)
  values ((select auth.uid()), p_company_id, case when p_id is null then 'Moto creada' else 'Moto actualizada' end, 'bike', result.id::text);
  return result;
end;
$$;

create or replace function public.manage_reward(
  p_id uuid, p_company_id uuid, p_title text, p_kind public.reward_kind, p_category text,
  p_points integer, p_detail text, p_terms text, p_validity_days integer,
  p_stock integer, p_image_url text
)
returns public.rewards
language plpgsql
security definer
set search_path = ''
as $$
declare result public.rewards; issued integer;
begin
  perform private.assert_active_user();
  if not private.has_company_access(p_company_id) then raise exception 'No tienes acceso a esta empresa.'; end if;
  if p_points not between 1 and 1000000 then raise exception 'Los puntos no son válidos.'; end if;
  if p_validity_days not between 1 and 3650 then raise exception 'La vigencia no es válida.'; end if;
  select count(*) into issued from public.coupons where reward_id = p_id;
  if p_stock < issued or p_stock > 10000 then raise exception 'El cupo no puede ser menor que los beneficios emitidos.'; end if;
  if p_id is null then
    insert into public.rewards(company_id,title,kind,category,points,detail,terms,validity_days,stock,image_url)
    values (p_company_id,btrim(p_title),p_kind,btrim(p_category),p_points,btrim(p_detail),btrim(p_terms),p_validity_days,p_stock,nullif(btrim(p_image_url),''))
    returning * into result;
  else
    update public.rewards set title=btrim(p_title),kind=p_kind,category=btrim(p_category),points=p_points,
      detail=btrim(p_detail),terms=btrim(p_terms),validity_days=p_validity_days,stock=p_stock,image_url=nullif(btrim(p_image_url),'')
    where id=p_id and company_id=p_company_id returning * into result;
    if result.id is null then raise exception 'La recompensa no existe en esta empresa.'; end if;
  end if;
  if p_kind = 'service' then
    update public.rewards set points=p_points where company_id=p_company_id and kind='service';
    update public.point_rules set points=p_points, updated_at=now() where company_id=p_company_id and kind='maintenance';
  end if;
  insert into public.audit_logs(actor_id, company_id, action, target_type, target_id)
  values ((select auth.uid()), p_company_id, case when p_id is null then 'Recompensa creada' else 'Recompensa actualizada' end, 'reward', result.id::text);
  return result;
end;
$$;

create or replace function public.archive_catalog_item(p_kind text, p_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare target_company uuid;
begin
  perform private.assert_active_user();
  if p_kind = 'bike' then select company_id into target_company from public.bikes where id=p_id;
  elsif p_kind = 'reward' then select company_id into target_company from public.rewards where id=p_id;
  else raise exception 'Tipo de catálogo inválido.'; end if;
  if target_company is null or not private.has_company_access(target_company) then raise exception 'No tienes acceso a este producto.'; end if;
  if p_kind='bike' then update public.bikes set archived=p_archived where id=p_id;
  else update public.rewards set archived=p_archived where id=p_id; end if;
  insert into public.audit_logs(actor_id,company_id,action,target_type,target_id)
  values ((select auth.uid()),target_company,case when p_archived then 'Producto archivado' else 'Producto restaurado' end,p_kind,p_id::text);
end;
$$;

create or replace function public.update_company_wallet(p_company_id uuid, p_address text)
returns public.companies
language plpgsql
security definer
set search_path = ''
as $$
declare result public.companies;
begin
  perform private.assert_active_user();
  if not private.has_company_access(p_company_id) then raise exception 'No tienes acceso a esta empresa.'; end if;
  if nullif(btrim(p_address),'') is not null and p_address !~ '^0x[0-9A-Fa-f]{40}$' then raise exception 'Dirección EVM inválida.'; end if;
  update public.companies set wallet_address=nullif(btrim(p_address),'') where id=p_company_id returning * into result;
  insert into public.audit_logs(actor_id,company_id,action,target_type,target_id)
  values ((select auth.uid()),p_company_id,'Wallet de empresa actualizada','company',p_company_id::text);
  return result;
end;
$$;

revoke all on function public.manage_company(uuid,text,text,text,text,text,text,public.company_status) from public;
revoke all on function private.assert_admin() from public, anon, authenticated;
revoke all on function public.update_point_rules(uuid,jsonb) from public;
revoke all on function public.manage_bike(uuid,uuid,text,text,text,text,text,numeric,text,text,jsonb) from public;
revoke all on function public.manage_reward(uuid,uuid,text,public.reward_kind,text,integer,text,text,integer,integer,text) from public;
revoke all on function public.archive_catalog_item(text,uuid,boolean) from public;
revoke all on function public.update_company_wallet(uuid,text) from public;
grant execute on function public.manage_company(uuid,text,text,text,text,text,text,public.company_status) to authenticated;
grant execute on function public.update_point_rules(uuid,jsonb) to authenticated;
grant execute on function public.manage_bike(uuid,uuid,text,text,text,text,text,numeric,text,text,jsonb) to authenticated;
grant execute on function public.manage_reward(uuid,uuid,text,public.reward_kind,text,integer,text,text,integer,integer,text) to authenticated;
grant execute on function public.archive_catalog_item(text,uuid,boolean) to authenticated;
grant execute on function public.update_company_wallet(uuid,text) to authenticated;
