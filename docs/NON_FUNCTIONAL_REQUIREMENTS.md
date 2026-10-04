# Requisitos no funcionales

## Matriz de cumplimiento

| Requisito | Estado de implementación | Evidencia |
|---|---|---|
| Seguridad: autenticación segura | Implementado | Supabase Auth por enlace de correo, sesión persistente y roles de servidor |
| Seguridad: cifrado de datos sensibles | Implementado en tránsito y en secretos | HTTPS en despliegue; secretos solo en Supabase, sin claves privadas en el frontend |
| Seguridad: acceso no autorizado | Implementado | RLS, validación duplicada en RPC/Edge Functions, estados bloqueado/baja y auditoría |
| Escalabilidad: nuevas marcas | Implementado | Empresas, identidad, catálogos y reglas son datos dinámicos; no requieren una vista nueva |
| Escalabilidad: nuevas funcionalidades | Implementado a nivel arquitectónico | Frontend, adaptador, funciones, migraciones y contratos separados por módulo |
| Integración con facturación/CRM | Implementado como API genérica | `integration-api`, vínculos externos, referencias idempotentes y bitácora |
| Disponibilidad: despliegue confiable | Configurado; requiere publicar | `vercel.json`, build reproducible, HTTPS y guía de comprobación |
| Disponibilidad: respaldo periódico | Automatizado; requiere configurar secretos y ejecutar una vez | GitHub Action diario, archivo AES-256, retención de 14 días y restauración documentada |
| Mantenibilidad: documentación | Implementado | README, arquitectura, backend, API, QA y operación |
| Mantenibilidad: control de versiones | Implementado | Git/GitHub y migraciones inmutables |
| Mantenibilidad: carpetas claras | Implementado | `frontend/`, `supabase/`, `contracts/` y `docs/` |

## Qué significa “configurado; requiere publicar”

El código no puede crear por sí solo una cuenta o plan de hosting, ni activar o verificar un respaldo de un proyecto privado sin autorización de esa plataforma. Para cerrar esos dos puntos como **operativos**, el responsable debe:

1. desplegar el repositorio y configurar las dos variables públicas de Supabase;
2. probar ingreso y navegación en la URL HTTPS;
3. configurar los cuatro secretos del workflow y comprobar una ejecución verde con artefacto cifrado;
4. registrar un simulacro de restauración en un proyecto separado.

Hasta entonces la aplicación está preparada técnicamente, pero no corresponde afirmar que la disponibilidad productiva o la restauración ya fueron comprobadas.
