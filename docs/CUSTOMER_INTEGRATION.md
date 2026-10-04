# Integración de perfiles, clientes existentes y roles

## Estado de esta entrega

El frontend registra nombre, correo, celular regional, marca y referido opcional. Cada perfil público nuevo es `client`; la marca se conserva en el perfil y puede actualizarse desde Mi club. Con Supabase configurado, Auth verifica el correo, los roles privilegiados se asignan desde el servidor y PostgreSQL conserva los datos. La Edge Function `integration-api` ya ofrece el contrato genérico para sincronizar clientes, consultar catálogo y compras, y confirmar ventas desde un CRM o sistema de facturación. La conexión con un proveedor concreto requiere únicamente sus credenciales y el mapeo de campos.

## Contrato de datos implementado

| Dato                             | Propósito                                                           | Responsable                              |
| -------------------------------- | ------------------------------------------------------------------- | ---------------------------------------- |
| `userId`                         | Identidad interna estable del usuario                               | Servicio de cuentas                      |
| `email`, `phone`                 | Contactos del cliente; la verificación depende del canal de alta    | Auth o sistema comercial autorizado      |
| `brandId`                        | Marca a la que se vincula el perfil                                 | Selección inicial y validación comercial |
| `externalCustomerId`             | Identificador del cliente en la base existente, dentro de esa marca | Conector de clientes                     |
| `role`                           | Cliente o administrador                                             | Backend, nunca el formulario de registro |
| `adminBrandScope`                | Empresas que puede administrar una cuenta                           | Administración de permisos               |
| `lastSyncedAt`, `source`         | Origen y fecha de la última sincronización                          | Conector                                 |

Una marca seleccionada por el usuario no acredita por sí sola una relación comercial. `profiles.primary_company_id` guarda la empresa principal; compras, movimientos y cupones relacionan al cliente con otras empresas sin mezclar saldos. `company_memberships` reserva las asignaciones operativas de cuentas empresariales.

## Registro y vinculación

1. Verificar identidad por correo y, cuando se requiera, celular. Crear sesión segura y perfil con rol cliente.
2. El sistema comercial llama desde su servidor a `POST /customers`, limitado a la empresa indicada, con su identificador externo estable.
3. Si correo e identificador coinciden, actualizar el vínculo. Ante registros duplicados o información contradictoria, responder `409` para revisión administrativa. Nunca aceptar un `externalCustomerId` enviado por el navegador como prueba de titularidad.
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

El conector reside en el backend y usa una clave independiente guardada como secreto de la Edge Function. Las credenciales y los datos completos del CRM no se exponen al frontend. Consulta el contrato, ejemplos y pruebas en [INTEGRATION_API.md](INTEGRATION_API.md).

La importación inicial y las actualizaciones posteriores hacen upsert por `(companyId, externalCustomerId)`. Las compras usan una referencia externa única por marca para evitar acreditar puntos dos veces. La sincronización no sustituye saldos por totales enviados desde el navegador ni sobrescribe wallets o referidos. Los resultados quedan correlacionados por `requestId`, y la bitácora evita almacenar el cuerpo de la solicitud o datos personales.

## Información necesaria para conectar la base real

- Proveedor y esquema de la base o API del sistema de clientes.
- Identificador estable del cliente y campos de marca, correo y celular.
- Forma de confirmar compras y mantenimientos: eventos, API, consultas periódicas o importación.
- Cuenta de servicio y método autorizado de conexión.
- Reglas para asignar administradores y su alcance por marca.

Estos datos no se han proporcionado todavía. La API genérica está implementada y probada por contrato, pero no se afirma que una base comercial real esté sincronizada hasta recibir el acceso autorizado de la empresa.
