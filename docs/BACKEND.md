# Backend Supabase de RideClub

El backend está preparado en `supabase/` y la interfaz cambia automáticamente de modo:

- sin `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, conserva la demo local;
- con ambas variables, usa Supabase Auth, PostgreSQL, RLS, funciones transaccionales y Edge Functions.

No incluye contratos, tokens, NFTs, pagos reales ni creación de wallets. Los campos de wallet solo reservan la configuración para la siguiente etapa.

## Qué queda conectado

| Área | Implementación |
|---|---|
| Registro e ingreso | Enlace seguro enviado por Supabase Auth al correo |
| Roles | `client`, `company`, `admin` en `profiles` |
| Estado de cuenta | `active`, `blocked`, `deleted`; bloqueo y baja impiden leer datos privados u operar |
| Empresas | Alta, edición, publicación, suspensión, identidad visual, correo de acceso y membresía |
| Catálogo | CRUD y archivado recuperable de motos y recompensas |
| Clientes | Alta y edición por admin; cada empresa solo opera clientes de su ámbito |
| Métricas en vivo | Perfiles, compras, puntos, canjes, cupones, actividad y auditoría con Supabase Realtime, filtrados por RLS |
| Puntos | Reglas por empresa, libro contable, saldo derivado y vencimiento trazable |
| Compra demo | Descuento de USDT, comprobante, puntos y referido en una transacción idempotente |
| Canje | Validación de saldo/cupo, descuento y cupón en una transacción |
| Taller | Acreditación con referencia única y consumo de cupón de un solo uso |
| Favoritas | Persistencia por cliente |
| Auditoría | Cambios administrativos y operaciones sensibles |

La administración global ve todas las empresas y puede crear clientes para cualquiera. Una empresa ve y modifica únicamente sus recursos y clientes relacionados. Una empresa `pending` puede preparar su dashboard pero no aparece públicamente; una empresa `suspended` pierde acceso y sus productos dejan de publicarse.

## Estructura

```text
supabase/
  config.toml
  migrations/
    20261003190000_schema.sql
    20261003190100_security.sql
    20261003190200_auth.sql
    20261003190300_core_rpc.sql
    20261003190400_management_rpc.sql
    20261004030000_realtime.sql
    20261004033000_balance_guard.sql
    20261004043000_scheduled_expiry.sql
    20261004053000_integration_api.sql
  functions/
    bootstrap-admin/
    manage-user/
    integration-api/
    _shared/
  tests/database.test.sql
  seed.sql
frontend/src/lib/supabase/
  client.ts
  api.ts
```

## Probar localmente

Requisitos: Node.js 22+, Docker Desktop y Supabase CLI.

Desde la raíz del repositorio:

```bash
npx supabase start
npx supabase db reset
npx supabase status
```

`supabase status` muestra la API URL, la anon key y la service role key locales. Crea `frontend/.env.local`:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=PEGA_AQUI_LA_ANON_KEY_LOCAL
```

Configura un secreto local para crear el primer administrador:

```bash
nano supabase/.env.local
```

Contenido:

```dotenv
BOOTSTRAP_SECRET=CAMBIA_ESTE_SECRETO
```

Luego levanta las funciones:

```bash
npx supabase functions serve --env-file supabase/.env.local
```

En otra terminal crea el primer administrador. Usa la anon key que mostró `supabase status`:

```bash
curl -i http://127.0.0.1:54321/functions/v1/bootstrap-admin \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer PEGA_AQUI_LA_ANON_KEY_LOCAL' \
  -H 'x-bootstrap-secret: CAMBIA_ESTE_SECRETO' \
  -d '{"email":"admin@rideclub.com","fullName":"Administración RideClub"}'
```

Luego ejecuta el frontend:

```bash
cd frontend
npm ci
npm run dev
```

El correo local llega a Inbucket, normalmente en `http://127.0.0.1:54324`. Abre el mensaje y pulsa el enlace de acceso.

## Pruebas automáticas

```bash
npx supabase db reset
npx supabase test db
cd frontend
npm test
npm run build
```

Para reiniciar únicamente la base local, vuelve a ejecutar `npx supabase db reset`. Esto elimina datos locales de Supabase y vuelve a aplicar migraciones y seed; no afecta un proyecto remoto.

## Desplegar en un proyecto Supabase

No ejecutes estos comandos hasta decidir publicar el backend:

```bash
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push
npx supabase secrets set BOOTSTRAP_SECRET=UN_SECRETO_LARGO_Y_UNICO INTEGRATION_API_KEY=OTRO_SECRETO_LARGO_Y_UNICO
npx supabase functions deploy manage-user
npx supabase functions deploy bootstrap-admin --no-verify-jwt
npx supabase functions deploy integration-api --no-verify-jwt
```

Después:

1. Configura en Supabase Auth la URL pública del sitio y sus redirect URLs.
2. Invoca una sola vez `bootstrap-admin` con el secreto para crear el administrador inicial.
3. Entra con ese correo mediante el enlace mágico.
4. Guarda cada empresa desde Administración para crear o sincronizar su usuario de acceso.
5. Añade a la plataforma de hosting `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; nunca expongas la service role key en variables `VITE_*`.
6. Tras crear el administrador, rota el secreto de bootstrap o elimina esa Edge Function del proyecto remoto.

La API de conexión con CRM/facturación, sus rutas y pruebas están en [INTEGRATION_API.md](INTEGRATION_API.md). El despliegue público, las cabeceras, los respaldos y el procedimiento de recuperación están en [OPERATIONS.md](OPERATIONS.md).

## Recorrido funcional recomendado

1. Inicia como admin y crea una empresa `active` con un correo real controlado por ti.
2. Cierra sesión, solicita acceso con ese correo y comprueba que solo ve su empresa.
3. Desde la empresa crea un cliente; desde el admin crea otro para una empresa distinta.
4. Bloquea el primer cliente, abre su enlace de acceso y verifica que se cierre la sesión sin mostrar datos privados.
5. Reactívalo, cambia `Mantenimiento` a 1.000 y verifica que las recompensas de servicio de esa empresa también cuesten 1.000.
6. Compra una moto como cliente y comprueba saldo USDT, comprobante, puntos y métricas de admin/empresa.
7. Canjea una recompensa y úsala desde Taller; el segundo uso debe ser rechazado.
8. Suspende la empresa y confirma que desaparece del catálogo público y que su cuenta empresarial ya no entra al dashboard.

## Seguridad aplicada

- RLS está habilitado en todas las tablas expuestas.
- La service role key solo se usa dentro de Edge Functions.
- Las altas y cambios de usuarios se validan nuevamente en `manage-user`.
- Las operaciones monetarias y de puntos usan funciones PostgreSQL transaccionales.
- La compra usa una clave de operación idempotente y un bloqueo transaccional para reintentos concurrentes.
- Los historiales no se borran al dar de baja clientes o archivar productos.
- Los saldos de puntos se actualizan desde el libro contable, no desde el navegador.
- Las URLs, teléfonos, colores, cantidades, cupos y vigencias tienen validación de base de datos.
