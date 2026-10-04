begin;

select plan(29);

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

select * from finish();
rollback;
