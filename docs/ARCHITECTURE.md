# RideClub · Arquitectura frontend y backend

React 19 + TypeScript + Vite. Interfaz responsive con CSS propio, Lucide y QRCode. Fotografías, logos y tipografía locales; sin dependencias de imágenes remotas al ejecutar la demo.

Supabase aporta Auth por correo y contraseña, confirmación inicial y recuperación por correo, PostgreSQL, Row Level Security, funciones transaccionales y Edge Functions. Si las variables públicas de Supabase no están presentes, el frontend conserva el motor local como modo de presentación.

## Módulos

- `src/data/catalog.ts`: nueve modelos con fuente, mercado, precio cuando está publicado y especificaciones; nueve recompensas propuestas; reglas de puntos.
- `src/lib/demo.ts`: estado local, cuentas, USDT ficticio, compras idempotentes, referidos, puntos por marca, emisión y consumo de cupones. Funciones puras que rechazan operaciones inválidas antes de cambiar el estado.
- `src/lib/phone.ts`: regiones, prefijos y normalización internacional del celular; sin SMS ni verificación real.
- `src/components/Checkout.tsx`: resumen de compra, saldo antes/después y comprobante de simulación.
- `src/components/Marketplace.tsx`: catálogo, filtros, búsqueda, orden, favoritas y ficha del modelo.
- `src/components/Landing.tsx`: portada pública, explicación del producto, funcionamiento, empresas y ofertas destacadas.
- `src/components/Rewards.tsx`: catálogo de propuestas y confirmación de canje.
- `src/components/Auth.tsx`: creación de perfil por correo, celular regional y código opcional, marca vinculada obligatoria, ingreso de demo y resultado del registro.
- `src/components/Club.tsx`: perfil, wallet pendiente, saldo USDT ficticio, puntos por marca, compras, tarjeta visual de beneficio, QR, actividad y referidos.
- `src/components/Workshop.tsx`: acreditar actividades confirmadas, validar cupones y exportar actividad.
- `src/components/Dashboard.tsx`: administración global y workspace empresarial con métricas, filtros, exportaciones, clientes, compras, catálogos, canjes y wallets.
- `src/data/CatalogContext.tsx`: catálogo dinámico derivado de empresas autorizadas y elementos publicados.
- `src/lib/business.ts`: control de alcance por rol, consultas agregadas, auditoría y operaciones de empresas, motos, recompensas y wallets.
- `src/lib/supabase/client.ts`: sesión persistente y cliente Supabase configurado solo con credenciales públicas.
- `src/lib/supabase/api.ts`: adapta tablas y RPC al modelo de vistas existente; conecta compras, canjes, taller, favoritas, perfiles y mutaciones del dashboard.
- `supabase/functions/integration-api`: interfaz HTTPS de servidor para sincronizar clientes, consultar catálogo/compras y registrar ventas externas idempotentes.
- Las reglas de puntuación pertenecen a cada empresa y guardan importe y vigencia para compra, referido, mantenimiento y evento. Cada acreditación registra `expiresAt`; al cargar la aplicación, los vencimientos pendientes descuentan el saldo una sola vez y generan un movimiento trazable.
- La gestión de clientes permite a cada empresa operar únicamente su propio ámbito y al administrador global operar cualquier cliente. Incluye altas, edición, bloqueo temporal y baja lógica. La baja conserva compras y canjes; RLS, Edge Functions y auditoría persistente aplican las mismas reglas en el servidor.
- `src/components/ui.tsx`: diálogos nativos, logos y componentes comunes.
- `src/App.tsx`: composición, navegación por hash, persistencia y operaciones del usuario.

## Persistencia, autorización y límites

En modo Supabase el servidor es la fuente de verdad. RLS limita cada lectura, las escrituras sensibles pasan por funciones `security definer` que vuelven a comprobar estado y alcance, y la service role key solo existe dentro de Edge Functions. Los roles son `client`, `company` y `admin`: el administrador tiene control global; una empresa solo consulta y modifica su ámbito; el cliente no ejecuta operaciones administrativas. `blocked` impide temporalmente el acceso y puede reactivarse; `deleted` representa baja lógica y conserva historial.

El modo local usa `localStorage` (`rideclub-demo-v1`) únicamente cuando faltan las variables de Supabase. No debe confundirse con la autorización del backend.

La regla `Mantenimiento` y los beneficios de tipo `service` de la misma empresa usan un valor sincronizado. Guardar cualquiera de los dos actualiza el otro; al migrar datos locales, el beneficio publicado se usa para reconciliar estados antiguos inconsistentes.

El administrador registra empresas con correo, estado e identidad visual. `active` las publica en landing y registro; `pending` permite preparar el dashboard sin publicar; `suspended` bloquea el acceso empresarial. El ingreso con el correo asignado usa Supabase Auth. El catálogo dinámico admite nuevas marcas sin modificar las vistas, y la auditoría registra cambios administrativos. Las eliminaciones de motos y recompensas son archivados recuperables para no romper el historial.

Un perfil nuevo empieza con cero puntos. La cuenta de Manuel tiene 1.000 puntos Zontes para el recorrido de demo. Cada perfil recibe un número aleatorio de ocho dígitos que no se repite dentro del estado local y un enlace `?ref=NUMERO#club`. El formulario admite código opcional y precarga el del enlace. Solo acepta códigos existentes en este navegador. Registrar un referido no acredita puntos: su primera compra de prueba premia automáticamente a quien lo invitó una sola vez. La confirmación manual de referido en taller comparte la protección contra duplicados, incluso entre marcas.

El perfil contiene `wallet: {status: 'pending', chainId: 84532}`. **No contiene una dirección inventada, claves privadas ni una wallet real.** En producción, el proveedor de cuentas por correo debe provisionar la wallet y devolver su dirección antes de indicar que existe.

El canje comprueba usuario, saldo de la marca y cupos; en una sola transacción descuenta puntos, crea el cupón y registra la actividad. El uso comprueba existencia, marca, vigencia, uso previo, nombre del taller y confirmación del cliente. No vuelve a descontar puntos. El cupón usado sigue en el historial. El QR solo codifica su identificador; no prueba titularidad ni consentimiento criptográfico.

## Compras y compatibilidad con cuentas anteriores

`balanceUSDT` es saldo ficticio independiente de los puntos y de una wallet. Las cuentas nuevas reciben 20.000 USDT de prueba. `loadDemo` conserva la clave y versión anteriores y agrega ese importe únicamente cuando falta el campo; no repone saldo gastado al recargar. Conserva cuentas, puntos, referidos, favoritas, cupones e historial anteriores. El celular queda opcional para perfiles antiguos y es obligatorio en registros nuevos. La marca también es obligatoria en nuevos registros. Se conserva la marca previamente guardada; las cuentas sin marca pueden elegirla en Mi club, sin cambiar puntos ni saldo USDT. `role` se normaliza a `client` cuando no existía; nuevos registros siempre son clientes. `enterAdminDemo` crea o reutiliza una cuenta pública de administrador de pruebas sin modificar el perfil del cliente.

`buy` consulta el precio del catálogo, comprueba cuenta y saldo, descuenta USDT, agrega 1.000 puntos de la marca, guarda el comprobante y acredita el referido elegible en una transición inmutable. Repetir el mismo `operationId` y modelo devuelve el resultado anterior. No se compran modelos sin precio publicado. `fundDemo` permite añadir 20.000 USDT ficticios desde Mi club.

La tarjeta visual incluye foto ilustrativa, beneficio, marca, número, estado, vigencia y condiciones. El QR se despliega solo para beneficios vigentes y disponibles. Tras validar el servicio, se marca consumido con una quema simulada y permanece el comprobante. El QR actual no es un NFT.

## Backend implementado

Las migraciones de `supabase/` crean empresas, perfiles, membresías, catálogos, reglas, saldos, libro de puntos, compras, cupones, favoritas, vínculos externos y auditoría. Las compras y canjes son transacciones atómicas; la compra demo es idempotente por cliente y clave de operación. La compra externa usa referencia única por empresa, con índice único y bloqueo transaccional; no permite reutilizarla entre clientes. El saldo de puntos se deriva del libro contable. El alta/edición privilegiada de usuarios usa la Edge Function `manage-user`; `bootstrap-admin` existe únicamente para crear el primer administrador. `integration-api` permite la conexión mediante un integrador central de confianza cuya clave global autoriza cualquier empresa. La sincronización de clientes tiene varios pasos y puede requerir conciliación tras fallos parciales; su ejecución remota no se verificó.

Consulta [BACKEND.md](BACKEND.md) para instalación y recorridos de verificación.

## Etapa siguiente: EVM

Red prevista: Base Sepolia, chain ID 84532. Hay contratos base en `contracts/`, sin compilación, auditoría, despliegue ni integración verificados.

1. Adaptar la [API genérica](INTEGRATION_API.md) a las credenciales y campos del CRM real de cada empresa.
2. Proveedor de wallet embebida que preserve las garantías de custodia acordadas.
3. Puntos ERC-20 por marca o contabilidad equivalente; restricciones de transferencia por definir.
4. Cupones ERC-721 personales: consumo de puntos y emisión atómica, expiración y quema autorizada.
5. Desafío firmado, nonce y vigencia corta para que una captura del QR no autorice el uso.
6. Indexación y conciliación de eventos on-chain pendientes, fallidos o reorganizados.

La interfaz ya sustituye las transiciones locales por llamadas a Supabase cuando encuentra la configuración pública. El modo local permanece solo como respaldo para la presentación.

Para el NFT real recomendamos consumir y quemar después de confirmar el servicio, con autorización del titular y permiso del taller. La imagen describe el beneficio; los atributos deben incluir servicio, marca y vigencia, sin correo ni celular públicos. El historial del servicio permanece en el backend tras la quema. Referencia técnica: [OpenZeppelin ERC721Burnable](https://docs.openzeppelin.com/contracts/5.x/api/token/erc721#ERC721Burnable).
