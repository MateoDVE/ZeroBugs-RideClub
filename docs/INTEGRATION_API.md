# API de integración con CRM y facturación

RideClub incluye una Edge Function de servidor para conectar sistemas comerciales sin exponer la `service_role` ni aceptar movimientos desde el navegador. La API usa HTTPS, una clave independiente en `x-integration-key`, referencias externas idempotentes y una bitácora sin cuerpos ni datos personales.

## Activación

Genera una clave diferente a las demás credenciales y despliega la función:

```bash
npx supabase secrets set INTEGRATION_API_KEY="$(openssl rand -hex 32)"
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

Cada respuesta incluye `requestId`. Los listados devuelven hasta 200 registros por solicitud.

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
- devuelve el mismo resultado al repetir exactamente la misma referencia;
- rechaza reutilizarla con otra moto o monto;
- registra auditoría y bitácora técnica.

## Prueba rápida

```bash
curl -sS \
  'https://TU_PROJECT_REF.supabase.co/functions/v1/integration-api/health' \
  -H 'x-integration-key: TU_CLAVE_DE_INTEGRACION'
```

Debe responder `{"ok":true,...}`. Una clave incorrecta debe devolver `401`. Después de sincronizar un cliente y registrar una compra, comprueba en los dashboards de empresa y administrador que aparezcan el cliente, la venta y los puntos. Repite la compra con la misma referencia y verifica que no aumenten nuevamente.

## Adaptación a un proveedor real

La API ya fija el contrato seguro de RideClub. Para un CRM o sistema de facturación específico falta mapear sus campos, autenticar su lado y decidir si llamará mediante webhook o sincronización programada. No es necesario cambiar el modelo de puntos ni permitir acceso directo a PostgreSQL.
