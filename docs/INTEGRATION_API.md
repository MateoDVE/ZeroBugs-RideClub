# API de integración con CRM y facturación

RideClub incluye una Edge Function para un integrador central de confianza. Usa una clave global en `x-integration-key` y ejecuta operaciones con `service_role`: quien posea esa clave puede seleccionar cualquier empresa. No ofrece credenciales aisladas por comercio ni vincula la clave al parámetro `company`. Nunca debe distribuirse a empresas independientes ni incluirse en el navegador; CORS no sustituye autorización. El integrador central debe comprobar el origen y los permisos de cada sistema antes de llamar. No se ha verificado su ejecución remota.

## Activación

Genera y conserva una clave aleatoria en un gestor de secretos. Cuando decidas desplegar, carga el mismo valor en el integrador central y en Supabase (el siguiente valor es un marcador):

```bash
npx supabase secrets set INTEGRATION_API_KEY="REEMPLAZAR_POR_SECRETO_GENERADO"
npx supabase functions deploy integration-api --no-verify-jwt
```

Conserva la clave únicamente en el gestor de secretos del sistema que llama a la API. Nunca debe estar en `frontend/.env*`, variables `VITE_*`, código, capturas ni URLs.

La URL base es:

```text
https://TU_PROJECT_REF.supabase.co/functions/v1/integration-api
```

Todas las peticiones, excepto `OPTIONS`, requieren:

```text
Content-Type: application/json
x-integration-key: TU_CLAVE_DE_INTEGRACION
```

Las respuestas de la API incluyen `requestId` (salvo el preflight CORS). Los listados devuelven hasta 200 registros, sin paginación implementada; no deben usarse como exportación completa. La bitácora técnica evita cuerpos y datos personales, pero su escritura no garantiza que toda solicitud quede registrada.

## Endpoints

| Método y ruta | Uso |
|---|---|
| `GET /health` | Verificar que la función responde |
| `GET /customers?company=zontes` | Clientes vinculados por la integración |
| `POST /customers` | Crear o sincronizar un cliente de una empresa |
| `GET /bikes?company=zontes` | Catálogo y precios de la empresa |
| `GET /purchases?company=zontes` | Compras registradas para la empresa |
| `POST /purchases` | Confirmar una compra externa y acreditar puntos |

### Crear o sincronizar un cliente

```bash
curl -sS -X POST \
  'https://TU_PROJECT_REF.supabase.co/functions/v1/integration-api/customers' \
  -H 'Content-Type: application/json' \
  -H 'x-integration-key: TU_CLAVE_DE_INTEGRACION' \
  -d '{
    "company":"zontes",
    "externalId":"CRM-CLIENTE-1042",
    "email":"cliente@ejemplo.com",
    "fullName":"Cliente de prueba",
    "phone":"+59170000000",
    "status":"active"
  }'
```

El vínculo es único por `(empresa, externalId)` y también por `(empresa, perfil)`. Si el correo pertenece a otro rol o empresa, la API responde `409` y no reasigna silenciosamente la cuenta.

Auth, perfil, vínculo y bitácora se actualizan en pasos separados, sin una transacción común. Un fallo puede dejar un alta parcial: revisar el estado antes de reintentar. Las colisiones explícitas devuelven `409`; otros errores de validación o base pueden devolver `400`, por lo que no se debe interpretar cualquier fallo como ausencia de cambios.

### Registrar una compra confirmada externamente

Primero consulta `GET /bikes` para obtener el UUID del modelo. Luego:

```bash
curl -sS -X POST \
  'https://TU_PROJECT_REF.supabase.co/functions/v1/integration-api/purchases' \
  -H 'Content-Type: application/json' \
  -H 'x-integration-key: TU_CLAVE_DE_INTEGRACION' \
  -d '{
    "company":"zontes",
    "externalId":"FACTURA-000184",
    "customerEmail":"cliente@ejemplo.com",
    "bikeId":"UUID_DE_LA_MOTO",
    "amountUSDT":10000
  }'
```

Esta operación:

- valida empresa, cliente y modelo;
- guarda la compra con la referencia `EXT:empresa:referencia`;
- acredita la regla de compra vigente de esa empresa;
- no descuenta el saldo USDT demo, porque el pago ya fue confirmado por el sistema externo;
- al repetir la referencia con el mismo cliente, moto y monto, devuelve la compra existente con `created: false`;
- rechaza reutilizarla con otro cliente, moto o monto dentro de la misma empresa;
- registra auditoría y bitácora técnica.

## Prueba rápida

```bash
curl -sS \
  'https://TU_PROJECT_REF.supabase.co/functions/v1/integration-api/health' \
  -H 'x-integration-key: TU_CLAVE_DE_INTEGRACION'
```

Debe responder `{"ok":true,...}`. Una clave incorrecta debe devolver `401`. Después de sincronizar un cliente y registrar una compra, comprueba en los dashboards de empresa y administrador que aparezcan el cliente, la venta y los puntos. Repite la compra con la misma referencia y verifica que no aumenten nuevamente.

## Adaptación a un proveedor real

El contrato está implementado, sin pruebas de ejecución de Edge Functions en esta entrega. Para un proveedor real faltan mapeo, autorización en el integrador central, estrategia de reintentos y pruebas de aislamiento y fallos parciales. La compra externa usa una RPC transaccional con bloqueo por empresa/referencia e índice único; las pruebas SQL incluidas aún deben ejecutarse. Para acceso directo de comercios se necesita diseñar credenciales por empresa antes de habilitarlo.
