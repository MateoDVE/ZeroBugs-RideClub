# Integración de perfiles, clientes existentes y roles

## Estado de esta entrega

El frontend registra nombre, correo, celular regional, marca y referido opcional. Cada perfil público nuevo es `client`; la marca se conserva en el perfil y puede actualizarse desde Mi club. Con Supabase configurado, Auth verifica el correo, los roles privilegiados se asignan desde el servidor y PostgreSQL conserva los datos. La Edge Function `integration-api` ya ofrece el contrato genérico para sincronizar clientes, consultar catálogo y compras, y confirmar ventas desde un CRM o sistema de facturación. La conexión con un proveedor concreto requiere credenciales, mapeo, autorización en el integrador central y pruebas de ejecución y fallos parciales.

## Contrato de datos implementado

| Dato                             | Propósito                                                           | Responsable                              |
| -------------------------------- | ------------------------------------------------------------------- | ---------------------------------------- |
| `userId`                         | Identidad interna estable del usuario                               | Servicio de cuentas                      |
| `email`, `phone`                 | Contactos del cliente; la verificación depende del canal de alta    | Auth o sistema comercial autorizado      |
| `brandId`                        | Marca a la que se vincula el perfil                                 | Selección inicial y validación comercial |
| `externalCustomerId`             | Identificador del cliente en la base existente, dentro de esa marca | Conector de clientes                     |
| `role`                           | Cliente, empresa o administrador                                             | Backend, nunca el formulario de registro |
| `adminBrandScope`                | Empresas que puede administrar una cuenta                           | Administración de permisos               |
| `lastSyncedAt`, `source`         | Origen y fecha de la última sincronización                          | Conector                                 |

Una marca seleccionada por el usuario no acredita por sí sola una relación comercial. `profiles.primary_company_id` guarda la empresa principal; compras, movimientos y cupones relacionan al cliente con otras empresas sin mezclar saldos. `company_memberships` reserva las asignaciones operativas de cuentas empresariales.

## Registro y vinculación

1. Verificar identidad por correo y, cuando se requiera, celular. Crear sesión segura y perfil con rol cliente.
2. El integrador central autorizado llama a `POST /customers` con la empresa y su identificador externo estable. La clave actual es global y no limita las empresas accesibles: el integrador debe autorizar el origen antes de llamar.
3. Si correo e identificador coinciden, actualizar el vínculo. Ante registros duplicados o información contradictoria, responder `409` para revisión administrativa. Nunca aceptar un `externalCustomerId` enviado por el navegador como prueba de titularidad.
4. Conservar el identificador interno, referido, wallet y movimientos del usuario al vincular o actualizar sus datos.
5. En una etapa futura, aprovisionar la wallet y mostrar su dirección solo cuando el proveedor confirme su creación; hoy permanece pendiente.

## Permisos

| Acción                                            | Cliente                | Administrador                               |
| ------------------------------------------------- | ---------------------- | ------------------------------------------- |
| Consultar su perfil, saldos, compras y beneficios | Propios                | Según alcance autorizado                    |
| Canjear puntos                                    | Propios                | Sin actuar por el cliente sin autorización  |
| Solicitar vínculo con una marca                   | Propio                 | Revisar dentro de su marca                  |
| Confirmar compras y acreditar puntos              | No                     | Dentro de su marca                          |
| Validar y consumir beneficios                     | Autoriza el uso propio | Confirma el servicio dentro de su marca     |
| Exportar datos de clientes o asignar roles        | No                     | Permisos explícitos y registro de auditoría |

Las operaciones del frontend se autorizan en el servidor mediante sesión y rol. La API externa usa la clave central global descrita arriba. Los contratos base aún no intervienen en estas operaciones. Cambiar `localStorage` o un campo del frontend no debe otorgar permisos de producción.

## Sincronización

El conector reside en el backend y usa una clave independiente guardada como secreto de la Edge Function. Las credenciales y los datos completos del CRM no se exponen al frontend. Consulta el contrato, ejemplos y pruebas en [INTEGRATION_API.md](INTEGRATION_API.md).

La importación crea vínculos y las actualizaciones conservan su propietario por `(companyId, externalCustomerId)`. Auth, perfil y vínculo se procesan en pasos separados: puede haber fallos parciales que requieran conciliación. Las compras usan una referencia externa única por empresa, incluso entre clientes, con bloqueo transaccional e índice único. No se sustituyen saldos por totales enviados desde el navegador ni se sobrescriben wallets o referidos. `requestId` permite correlacionar respuestas; la bitácora no guarda cuerpos ni datos personales y su escritura puede fallar.

## Información necesaria para conectar la base real

- Proveedor y esquema de la base o API del sistema de clientes.
- Identificador estable del cliente y campos de marca, correo y celular.
- Forma de confirmar compras y mantenimientos: eventos, API, consultas periódicas o importación.
- Cuenta de servicio y método autorizado de conexión.
- Reglas para asignar administradores y su alcance por marca.

Estos datos no se han proporcionado todavía. La API genérica está implementada, pero no se ejecutaron pruebas de Edge Functions ni la suite SQL en esta entrega y no hay una base comercial real sincronizada verificada.
