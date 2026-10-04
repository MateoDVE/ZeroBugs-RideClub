begin;

select plan(33);

select has_table('public', 'companies', 'companies existe');
select has_table('public', 'profiles', 'profiles existe');
select has_table('public', 'purchases', 'purchases existe');
select has_table('public', 'point_ledger', 'point_ledger existe');
select has_table('public', 'coupons', 'coupons existe');
select has_table('public', 'audit_logs', 'audit_logs existe');
select has_table('public', 'external_customer_links', 'vínculos externos existen');
select has_table('public', 'integration_logs', 'bitácora de integración existe');

select has_function('public', 'account_access_status', array[]::text[], 'estado de acceso existe');
select has_function('public', 'my_referrals', array[]::text[], 'consulta segura de referidos existe');
select has_function('public', 'purchase_bike', array['uuid', 'text'], 'compra transaccional existe');
select has_function('public', 'redeem_reward', array['uuid'], 'canje transaccional existe');
select has_function('public', 'credit_activity', array['uuid', 'uuid', 'activity_kind', 'text', 'boolean'], 'acreditación existe');
select has_function('public', 'use_coupon', array['text', 'text', 'boolean'], 'uso de cupón existe');
select has_function('public', 'manage_company', array['uuid', 'text', 'text', 'text', 'text', 'text', 'text', 'company_status'], 'gestión de empresa existe');
select has_function('private', 'expire_all_points', array[]::text[], 'vencimiento automático existe');
select has_function('public', 'record_external_purchase', array['text', 'text', 'text', 'uuid', 'numeric'], 'registro externo de compras existe');

select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'RLS en perfiles');
select ok((select relrowsecurity from pg_class where oid = 'public.purchases'::regclass), 'RLS en compras');
select ok((select relrowsecurity from pg_class where oid = 'public.point_ledger'::regclass), 'RLS en movimientos');
select ok((select relrowsecurity from pg_class where oid = 'public.coupons'::regclass), 'RLS en cupones');
select ok((select relrowsecurity from pg_class where oid = 'public.external_customer_links'::regclass), 'RLS en vínculos externos');
select ok((select relrowsecurity from pg_class where oid = 'public.integration_logs'::regclass), 'RLS en bitácora de integración');

select is((select count(*)::integer from public.companies), 3, 'seed incluye tres empresas');
select is((select count(*)::integer from public.bikes), 9, 'seed incluye nueve motos');
select is((select count(*)::integer from public.rewards), 9, 'seed incluye nueve recompensas');
select is((select count(*)::integer from public.point_rules), 12, 'cada empresa tiene cuatro reglas');
select is((select count(*)::integer from public.point_rules where kind = 'purchase'), 3, 'compra se configura una vez por empresa');
select is((select count(*)::integer from public.rewards where kind = 'service' and points = 500), 3, 'mantenimiento inicia sincronizado');

-- Fixtures aisladas: la transacción completa se revierte al terminar.
insert into auth.users(id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-000000000001', 'integration-one@example.test', '{"full_name":"Integration One","brand":"Zontes"}'),
  ('a0000000-0000-4000-8000-000000000002', 'integration-two@example.test', '{"full_name":"Integration Two","brand":"Zontes"}');

select is(
  (public.record_external_purchase('zontes', 'integration-one@example.test', 'TEST-INVOICE-001',
    (select b.id from public.bikes b join public.companies c on c.id = b.company_id where c.slug = 'zontes' and not b.archived limit 1), 1000)->>'created')::boolean,
  true, 'primera factura crea la compra');
select is(
  (public.record_external_purchase('zontes', 'integration-one@example.test', 'TEST-INVOICE-001',
    (select b.id from public.bikes b join public.companies c on c.id = b.company_id where c.slug = 'zontes' and not b.archived limit 1), 1000)->>'created')::boolean,
  false, 'reintento no duplica la compra');
select throws_ok(
  $$select public.record_external_purchase('zontes', 'integration-two@example.test', 'TEST-INVOICE-001',
    (select b.id from public.bikes b join public.companies c on c.id = b.company_id where c.slug = 'zontes' and not b.archived limit 1), 1000)$$,
  'P0001', 'La referencia externa ya pertenece a otra compra.', 'factura no se reutiliza para otro cliente');
select is(
  (select count(*)::integer from public.purchases where operation_id = 'EXT:zontes:TEST-INVOICE-001'),
  1, 'solo persiste una compra con la referencia');

select * from finish();
rollback;
