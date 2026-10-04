# Integración de perfiles, clientes existentes y roles

## Estado de esta entrega

El frontend registra nombre, correo, celular regional, marca y referido opcional. Cada perfil público nuevo es `client`; la marca se conserva en el perfil y puede actualizarse desde Mi club. Con Supabase configurado, Auth verifica el correo, los roles privilegiados se asignan desde el servidor y PostgreSQL conserva los datos. Todavía no existe conexión con un CRM o base comercial externa.

## Contrato de datos implementado

| Dato                             | Propósito                                                           | Responsable                              |
| -------------------------------- | ------------------------------------------------------------------- | ---------------------------------------- |
| `userId`                         | Identidad interna estable del usuario                               | Servicio de cuentas                      |
| `verifiedEmail`, `verifiedPhone` | Contactos cuya titularidad se verificó                              | Proveedor de autenticación               |
| `brandId`                        | Marca a la que se vincula el perfil                                 | Selección inicial y validación comercial |
| `externalCustomerId`             | Identificador del cliente en la base existente, dentro de esa marca | Conector de clientes                     |
| `linkStatus`                     | Pendiente, vinculado o requiere revisión                            | Backend                                  |
| `role`                           | Cliente o administrador                                             | Backend, nunca el formulario de registro |
| `adminBrandScope`                | Empresas que puede administrar una cuenta                           | Administración de permisos               |
| `lastSyncedAt`, `sourceVersion`  | Estado y versión de la última sincronización                        | Conector                                 |

Una marca seleccionada por el usuario no acredita por sí sola una relación comercial. `profiles.primary_company_id` guarda la empresa principal; compras, movimientos y cupones relacionan al cliente con otras empresas sin mezclar saldos. `company_memberships` reserva las asignaciones operativas de cuentas empresariales.

## Registro y vinculación

1. Verificar identidad por correo y, cuando se requiera, celular. Crear sesión segura y perfil con rol cliente.
2. Consultar los clientes existentes únicamente dentro de la marca seleccionada, utilizando contactos verificados y el identificador externo de la empresa.
3. Si la coincidencia es única y válida, guardar el vínculo. Ante registros duplicados o información contradictoria, dejar pendiente para revisión administrativa. Nunca aceptar un `externalCustomerId` enviado por el navegador como prueba de titularidad.
4. Conservar el identificador interno, referido, wallet y movimientos del usuario al vincular o actualizar sus datos.
5. Aprovisionar la wallet al autenticar y mostrar su dirección solo cuando el proveedor confirme su creación.

## Permisos

| Acción                                            | Cliente                | Administrador                               |
| ------------------------------------------------- | ---------------------- | ------------------------------------------- |
| Consultar su perfil, saldos, compras y beneficios | Propios                | Según alcance autorizado                    |
| Canjear puntos                                    | Propios                | Sin actuar por el cliente sin autorización  |
| Solicitar vínculo con una marca                   | Propio                 | Revisar dentro de su marca                  |
| Confirmar compras y acreditar puntos              | No                     | Dentro de su marca                          |
| Validar y consumir beneficios                     | Autoriza el uso propio | Confirma el servicio dentro de su marca     |
| Exportar datos de clientes o asignar roles        | No                     | Permisos explícitos y registro de auditoría |

Cada petición se autoriza en el servidor. Las operaciones sobre beneficios y puntos se autorizan también en los contratos cuando corresponda. Cambiar `localStorage` o un campo del frontend no debe otorgar permisos de producción.

## Sincronización

El conector residirá en el backend y usará credenciales de servicio. Se acordará si la empresa ofrece API/CRM, acceso de lectura a su base o una importación autorizada. Las credenciales y los datos completos del CRM no se expondrán al frontend.

La importación inicial y las actualizaciones posteriores harán upsert por `(brandId, externalCustomerId)`. Las compras y mantenimientos tendrán una referencia externa única por marca para evitar acreditar puntos dos veces. La sincronización no sustituirá saldos por totales enviados desde el navegador ni sobrescribirá wallets o referidos. Los fallos y conflictos se registrarán para reintento y revisión, manteniendo los datos anteriores.

## Información necesaria para conectar la base real

- Proveedor y esquema de la base o API del sistema de clientes.
- Identificador estable del cliente y campos de marca, correo y celular.
- Forma de confirmar compras y mantenimientos: eventos, API, consultas periódicas o importación.
- Cuenta de servicio y método autorizado de conexión.
- Reglas para asignar administradores y su alcance por marca.

Estos datos no se han proporcionado todavía. El documento prepara la integración; no afirma que se haya sincronizado una base real.
